#!/usr/bin/env bash
# install_sync_cron.sh
# ---------------------------------------------------------------
# Adds cron entries to run `sync_vectors.sh` 5 times daily:
# - 5:00 AM
# - 11:00 AM
# - 2:00 PM
# - 5:00 PM
# - 10:00 PM
# ---------------------------------------------------------------
# How to use:
# 1. Make it executable: chmod +x install_sync_cron.sh
# 2. Run it once: ./install_sync_cron.sh
# 3. Check the crontab: crontab -l
# ---------------------------------------------------------------

# SCRIPT:
# 1. Resolve the absolute path to `sync_vectors.sh`
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_SH="${SCRIPT_DIR}/sync_vectors.sh"
LOGFILE="${SCRIPT_DIR}/sync_vectors.log"

# 2. Make sure sync_vectors.sh is executable
chmod +x "$SYNC_SH"

# 3. Define the cron lines (using absolute paths)
#          ┌──────── minute
#          │ ┌────── hour
#          │ │ ┌──── day of month (*)
#          │ │ │ ┌── month (*)
#          │ │ │ │ ┌ day of week (*)
#          │ │ │ │ │
CRON_05AM="0 5 * * * cd $SCRIPT_DIR && $SYNC_SH >> $LOGFILE 2>&1"
CRON_11AM="0 11 * * * cd $SCRIPT_DIR && $SYNC_SH >> $LOGFILE 2>&1"
CRON_02PM="0 14 * * * cd $SCRIPT_DIR && $SYNC_SH >> $LOGFILE 2>&1"
CRON_05PM="0 17 * * * cd $SCRIPT_DIR && $SYNC_SH >> $LOGFILE 2>&1"
CRON_10PM="0 22 * * * cd $SCRIPT_DIR && $SYNC_SH >> $LOGFILE 2>&1"

# 4. Install them (remove old entries first, then add new ones)
#    - list existing crons (or empty)
#    - filter out any old sync_vectors.sh lines
#    - append our new lines
{
  crontab -l 2>/dev/null | grep -v -F "sync_vectors.sh"
  echo "0 5 * * * cd \"$SCRIPT_DIR\" && \"$SYNC_SH\" >> \"$LOGFILE\" 2>&1"
  echo "0 11 * * * cd \"$SCRIPT_DIR\" && \"$SYNC_SH\" >> \"$LOGFILE\" 2>&1"
  echo "0 14 * * * cd \"$SCRIPT_DIR\" && \"$SYNC_SH\" >> \"$LOGFILE\" 2>&1"
  echo "0 17 * * * cd \"$SCRIPT_DIR\" && \"$SYNC_SH\" >> \"$LOGFILE\" 2>&1"
  echo "0 22 * * * cd \"$SCRIPT_DIR\" && \"$SYNC_SH\" >> \"$LOGFILE\" 2>&1"
} | crontab -

echo "✅ Cron jobs installed. Sync will run at:"
echo "   - 5:00 AM"
echo "   - 11:00 AM"
echo "   - 2:00 PM"
echo "   - 5:00 PM"
echo "   - 10:00 PM"
echo ""
echo "📝 Logs will be written to: $LOGFILE"
echo ""
echo "To verify, run: crontab -l"
