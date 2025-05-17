#!/usr/bin/env bash
# install_daily_cron.sh
# ---------------------------------------------------------------
# Adds a cron entry to run `daily.sh` at 16:00 (4:00 PM) daily.
# Visit `daily.sh` for more information.
# Basically, it runs a crawler and saves the results to DB.
# Then, it cleans up unmeaningful entries from the DB and
# sends a newsletter to subscribers.
# Run this script on your server or local machine to set up the cron job.
# ---------------------------------------------------------------
# How to use:
# 1. Make it executable: chmod +x install_daily_cron.sh
# 2. Run it once: ./install_daily_cron.sh
# 3. Check the crontab: crontab -l
# You should see a line like this: 0 16 * * * /home/you/scripts/daily.sh >> /home/you/scripts/daily.log 2>&1
# ENSURE your machine is on and available at the time of the cron job for the script to run!

# SCRIPT:
# 1. Resolve the absolute path to `daily.sh`
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAILY_SH="${SCRIPT_DIR}/daily.sh"
LOGFILE="${SCRIPT_DIR}/daily.log"

# 2. Make sure daily.sh is executable
chmod +x "$DAILY_SH"

# 3. Define the cron line
#          ┌──────── minute (0)
#          │ ┌────── hour   (16)
#          │ │ ┌──── day    (*)
#          │ │ │ ┌── month  (*)
#          │ │ │ │ ┌ day-of-week (*)
#          │ │ │ │ │
CRON_JOB="0 16 * * * $DAILY_SH >> $LOGFILE 2>&1"

# 4. Install it (if not already present)
#    - list existing crons (or empty)
#    - filter out any old daily.sh lines
#    - append our new line
( crontab -l 2>/dev/null | grep -v -F "$DAILY_SH" ; echo "$CRON_JOB" ) | crontab -

echo "✅ Cron job installed. Will run daily.sh at 12:00 PM and log to $LOGFILE"
