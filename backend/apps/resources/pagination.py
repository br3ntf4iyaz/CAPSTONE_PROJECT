from rest_framework.pagination import PageNumberPagination


class LibraryPagination(PageNumberPagination):
    """The library and scholarship pages show every record at once, so a page must hold them all.

    The default page size of 20 silently hid everything after the 20th record and made the
    category counts wrong.
    """

    page_size = 500
    page_size_query_param = 'page_size'
    max_page_size = 1000
