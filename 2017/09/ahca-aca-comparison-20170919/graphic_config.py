#!/usr/bin/env python

import base_filters

# using the same spreadsheet as ahca-aca-comparison-20170622
COPY_GOOGLE_DOC_KEY = '1Ysrqn0x-STAuqTliUe45wOJ-Wv2f6cdjSHb9AwtC5bE'

USE_ASSETS = False

# Use these variables to override the default cache timeouts for this graphic
# DEFAULT_MAX_AGE = 20
# ASSETS_MAX_AGE = 300

JINJA_FILTER_FUNCTIONS = base_filters.FILTERS
