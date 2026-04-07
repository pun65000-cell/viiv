#!/bin/bash

FILE="AI_MODE.txt"

case "$1" in
  start)
    echo -e "STATUS=ON\nMODE=DEBUG\nMAX_LINES=180" > $FILE
    echo "AI STARTED (DEBUG)"
    ;;
  stop)
    echo -e "STATUS=OFF" > $FILE
    echo "AI STOPPED"
    ;;
  debug)
    echo -e "STATUS=ON\nMODE=DEBUG\nMAX_LINES=180" > $FILE
    echo "DEBUG MODE"
    ;;
  build)
    echo -e "STATUS=ON\nMODE=BUILD\nMAX_LINES=UNLIMITED" > $FILE
    echo "BUILD MODE"
    ;;
  bypass)
    echo -e "STATUS=ON\nMODE=BYPASS\nMAX_LINES=SAFE" > $FILE
    echo "BYPASS MODE"
    ;;
  status)
    cat $FILE
    ;;
  *)
    echo "Usage: ./AI_CONTROL.sh [start|stop|debug|build|bypass|status]"
    ;;
esac
