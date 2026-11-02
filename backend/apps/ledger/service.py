"""
Anchoring service.

Only a SHA-256 fingerprint of each record is written to a ledger. Personal data
stays in the database, so records can still be corrected or erased under the
Data Privacy Act; once a record changes, its fingerprint no longer matches the
anchored one and verification reports it.

Backends (settings.ANCHOR_BACKEND):
  "ledger" – local hash-chained table (LedgerEntry). Works offline, no keys.
  "evm"    – the fingerprint is sent as data in a 0-value transaction to a
             public EVM chain (e.g. Polygon Amoy).
"""
import hashlib
import json
import logging
import threading

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Anchor, LedgerEntry

log = logging.getLogger(__name__)

GENESIS = '0' * 64
DATA_PREFIX = b'LYDO1'          # marks our transactions; followed by the 32-byte fingerprint
LOCAL_NETWORK = 'LYDO local ledger'


# ─── fingerprints ────────────────────────────────────────────────────────────

def canonical_hash(payload: dict) -> str:
    blob = json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False, default=str)
    return hashlib.sha256(blob.encode('utf-8')).hexdigest()


def file_sha256(fieldfile):
    """SHA-256 of an uploaded file, None if there is no file, 'missing' if it vanished from disk."""
    if not fieldfile or not getattr(fieldfile, 'name', ''):
        return None
    h = hashlib.sha256()
    try:
        with fieldfile.storage.open(fieldfile.name, 'rb') as fh:
            for chunk in iter(lambda: fh.read(1024 * 1024), b''):
                h.update(chunk)
    except (FileNotFoundError, OSError):
        return 'missing'
    return h.hexdigest()


# ─── local ledger ────────────────────────────────────────────────────────────

def _entry_hash(index, payload_hash, prev_hash):
    return hashlib.sha256(f'{index}|{payload_hash}|{prev_hash}'.encode()).hexdigest()


@transaction.atomic
def ledger_append(payload_hash: str) -> LedgerEntry:
    last = LedgerEntry.objects.order_by('-index').first()
    index = 0 if last is None else last.index + 1
    prev = GENESIS if last is None else last.entry_hash
    return LedgerEntry.objects.create(
        index=index, payload_hash=payload_hash, prev_hash=prev,
        entry_hash=_entry_hash(index, payload_hash, prev),
    )


def ledger_is_intact() -> bool:
    prev = GENESIS
    for i, e in enumerate(LedgerEntry.objects.order_by('index')):
        if e.index != i or e.prev_hash != prev or e.entry_hash != _entry_hash(e.index, e.payload_hash, prev):
            return False
        prev = e.entry_hash
    return True


# ─── EVM chain ───────────────────────────────────────────────────────────────

def _w3():
    from web3 import Web3
    return Web3(Web3.HTTPProvider(settings.ANCHOR_RPC_URL, request_kwargs={'timeout': 30}))


def evm_send(content_hash: str):
    """Send the fingerprint on-chain. Returns (tx_hash_hex, receipt)."""
    w3 = _w3()
    acct = w3.eth.account.from_key(settings.ANCHOR_PRIVATE_KEY)
    tx = {
        'to': acct.address, 'value': 0, 'data': DATA_PREFIX + bytes.fromhex(content_hash),
        'nonce': w3.eth.get_transaction_count(acct.address),
        'chainId': settings.ANCHOR_CHAIN_ID,
        'gas': 60000, 'gasPrice': w3.eth.gas_price,
    }
    signed = acct.sign_transaction(tx)
    raw = getattr(signed, 'raw_transaction', None) or signed.rawTransaction
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    return tx_hash.hex().removeprefix('0x'), receipt


def evm_check(anchor) -> bool:
    """Read the transaction back from the chain and compare its data to the fingerprint."""
    w3 = _w3()
    tx = w3.eth.get_transaction('0x' + anchor.tx_hash)
    receipt = w3.eth.get_transaction_receipt('0x' + anchor.tx_hash)
    return bytes(tx['input']) == DATA_PREFIX + bytes.fromhex(anchor.content_hash) and receipt['status'] == 1


# ─── writing ─────────────────────────────────────────────────────────────────

def push(anchor_pk: int) -> None:
    """Write one pending/failed anchor to the configured ledger and record the result."""
    a = Anchor.objects.filter(pk=anchor_pk).first()
    if a is None or a.status == Anchor.Status.ANCHORED:
        return
    try:
        if settings.ANCHOR_BACKEND == 'evm':
            tx_hash, receipt = evm_send(a.content_hash)
            fields = dict(
                tx_hash=tx_hash, network=settings.ANCHOR_NETWORK_NAME, block=receipt['blockNumber'],
                status=Anchor.Status.ANCHORED if receipt['status'] == 1 else Anchor.Status.FAILED,
            )
        else:
            e = ledger_append(a.content_hash)
            fields = dict(tx_hash=e.entry_hash, network=LOCAL_NETWORK, block=e.index,
                          status=Anchor.Status.ANCHORED)
        Anchor.objects.filter(pk=a.pk).update(anchored_at=timezone.now(), **fields)
    except Exception:
        log.exception('Anchoring failed for %s:%s', a.kind, a.ref)
        Anchor.objects.filter(pk=a.pk).update(status=Anchor.Status.FAILED)


def _push_soon(anchor_pk: int) -> None:
    """EVM confirmation can take seconds, so keep it off the request thread."""
    if settings.ANCHOR_BACKEND == 'evm':
        threading.Thread(target=push, args=(anchor_pk,), daemon=True).start()
    else:
        push(anchor_pk)


def record(kind: str, ref, payload: dict) -> Anchor:
    """
    Fingerprint `payload` and anchor it. If the latest anchor for this record already
    has the same fingerprint nothing new is written.
    """
    ref = str(ref)
    h = canonical_hash(payload)
    last = Anchor.objects.filter(kind=kind, ref=ref).first()
    if last and last.content_hash == h:
        return last
    a = Anchor.objects.create(kind=kind, ref=ref, content_hash=h)
    transaction.on_commit(lambda: _push_soon(a.pk))
    return a


def retry_unanchored() -> int:
    n = 0
    for a in Anchor.objects.exclude(status=Anchor.Status.ANCHORED):
        push(a.pk)
        n += 1
    return n


# ─── verifying ───────────────────────────────────────────────────────────────

class Verifier:
    """
    Compares a record as it is now with what was anchored. Create one per request:
    the ledger is read once and reused for every record checked.

    status:
      verified   – matches the ledger
      changed    – the record is different from what was anchored
      tampered   – the ledger entry is missing, altered, or does not match
      pending    – waiting to be written to the ledger
      failed     – writing to the ledger failed (retry with `anchor_ledger`)
      unanchored – never anchored
    """

    def __init__(self):
        self._entries = None
        self._chain_ok = None

    def _load(self):
        if self._entries is None:
            self._entries = {e.entry_hash: e for e in LedgerEntry.objects.all()}
            self._chain_ok = ledger_is_intact()

    def check(self, kind: str, ref, payload: dict) -> dict:
        a = Anchor.objects.filter(kind=kind, ref=str(ref)).first()
        if a is None:
            return {'status': 'unanchored'}
        info = {
            'network': a.network, 'tx_hash': a.tx_hash, 'block': a.block,
            'anchored_at': a.anchored_at, 'fingerprint': a.content_hash,
            'explorer_url': self.explorer_url(a),
        }
        if a.status == Anchor.Status.PENDING:
            return {**info, 'status': 'pending'}
        if a.status == Anchor.Status.FAILED:
            return {**info, 'status': 'failed'}
        if canonical_hash(payload) != a.content_hash:
            return {**info, 'status': 'changed'}
        try:
            if a.network == LOCAL_NETWORK:
                self._load()
                e = self._entries.get(a.tx_hash)
                ok = bool(e and e.payload_hash == a.content_hash and self._chain_ok)
            else:
                ok = evm_check(a)
        except Exception:
            log.exception('Ledger check failed for %s:%s', a.kind, a.ref)
            return {**info, 'status': 'failed'}
        return {**info, 'status': 'verified' if ok else 'tampered'}

    @staticmethod
    def explorer_url(a) -> str:
        if a.network and a.network != LOCAL_NETWORK and a.tx_hash:
            return settings.ANCHOR_EXPLORER_TX_URL + '0x' + a.tx_hash
        return ''
