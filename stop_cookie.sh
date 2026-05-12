#!/bin/bash
kill $(lsof -ti:8005) 2>/dev/null && echo "modulecookie stopped" || echo "modulecookie not running"
