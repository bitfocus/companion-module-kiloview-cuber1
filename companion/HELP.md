# Kiloview CUBE R1

This module will allow you to control Kiloview CUBE R1 multi-channel NDI recorder devices.

## Configuration

- **Device IP / Host** — Enter the IP address or hostname of the device
- **Port** — Connection port (default: 80)
- **Use Authentication** — Enable/disable login credentials
- **Username / Password** — Device login credentials (default: admin/admin)
- **Default Layout** — Initial layout selection (1/4/9 split)
- **Enable Polling** — Enable polling for feedbacks and variables (recommended: enabled)
- **Polling Rate** — Configurable interval for state polling (in ms)
- **Polling Rate for Sources** — Configurable interval for NDI source list polling (in ms)
- **Verbose Logging** — Enable debug-level logging for troubleshooting

## Actions

### General Actions
- **Set Layout** — Switch between 1/4/9 split layouts
- **Refresh Device Status** — Manually trigger a status refresh
- **Reboot Device** — Reboot the CUBE R1 device
- **Set Hostname** — Change device hostname
- **Set Time Zone** — Change device time zone

### Source Actions
- **Set Source** — Assign an NDI source to a specific position
- **Remove Source** — Remove NDI source from a position
- **Remove All Sources** — Remove all NDI sources from all positions
- **Set Channel Name** — Rename a channel on a specific position
- **Refresh Source List** — Manually refresh the NDI source discovery
- **Add Source** — Add a new NDI source group manually
- **Remove Source Group** — Remove an NDI source group
- **Modify Source Group** — Modify an existing NDI source group

### Recording Actions
- **Start/Stop All Recording** — Start or stop recording on all channels
- **Start/Stop Single Recording** — Start or stop recording on a specific channel
- **Set Recording Info** — Configure recording settings (timed, file format, etc.)
- **Set Record Mode** — Switch between Record mode and Director mode
- **Set Audio Line-In** — Enable/disable line-in for a specific recording channel
- **Set All Audio Line-In** — Set line-in audio for multiple channels at once
- **Set Audio Line-In Delay** — Set line-in audio delay value

### Storage Actions
- **Set Storage Config** — Configure storage settings (record mode, backup, NAS)
- **Format Disk** — Format SSD1 or SSD2
- **Add NAS** — Add a NAS storage target
- **Update NAS** — Modify NAS connection settings
- **Delete NAS** — Remove a NAS storage target
- **Add FTP Server** — Add an FTP upload server
- **Update FTP Server** — Modify FTP server settings
- **Delete FTP Server** — Remove an FTP server
- **Upload to FTP** — Start FTP upload of files
- **Re-upload to FTP** — Retry a failed FTP upload
- **Cancel FTP Upload** — Cancel a specific FTP upload
- **Cancel All FTP Uploads** — Cancel all FTP uploads

### Playback Actions
- **Get Playlist** — Retrieve playlist info for a channel/time range
- **Delete Recording** — Delete specified recording files

## Feedbacks

- **Layout** — Change button color based on current layout (1/4/9 split)
- **Recording Status** — Change button color based on whether recording is active
- **Source Online** — Change button color based on whether a source is connected on a specific position
- **Record Mode** — Change button color based on current record mode (Record/Director)

## Variables

### System
- **hostname** — Device hostname
- **firmware_version** — Firmware version
- **serial_number** — Device serial number
- **product** — Product name
- **cpu_usage** — CPU usage percentage
- **gpu_usage** — GPU usage percentage
- **memory_used** — Used memory
- **memory_total** — Total memory
- **temperature** — Device temperature
- **uptime** — Device uptime

### Layout
- **layout** — Current layout (1/4/9)
- **layout_number** — Number of channels in current layout

### Recording
- **recording** — Whether recording is active (True/False)
- **saving** — Whether saving is in progress (True/False)
- **record_mode** — Current mode (Record/Director)

### Sources (per position 1-9)
- **source_N_name** — Source name at position N
- **source_N_ip** — Source IP at position N
- **source_N_online** — Whether source at position N is online
- **channel_N_name** — Channel name at position N

### Storage
- **ssd1_usage** — SSD1 usage percentage
- **ssd2_usage** — SSD2 usage percentage