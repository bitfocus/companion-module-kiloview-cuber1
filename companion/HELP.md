# Kiloview CUBE R1

This module controls the Kiloview CUBE R1 NDI High Bandwidth + NDI|HX Multi-Channel Recording System using its HTTP API. It supports starting and stopping recording, switching the 1/4/9 multiview layout, assigning discovered NDI sources to windows, per-window audio and video controls, storage settings and device status monitoring.

## Configuration

- **Device IP / Host** — Enter the IP address or hostname of the CUBE R1
- **Protocol** — HTTP (port: 80) or HTTPS (port: 443). The CUBE R1 web interface is served over HTTP on port 80 by default
- **Port** — Connection port (defaults to 80 for HTTP, 443 for HTTPS)
- **Username / Password** — Device login credentials. The factory defaults are `admin` / `admin`. The module logs in again automatically if the device session expires
- **Enable Polling** — Enable polling for feedbacks and variables (recommended: enabled)
- **Polling Rates** — Configurable intervals for the recording/window state and for sources, storage and system info
- **HTTP Request Timeout** — How long to wait for the device to answer a request
- **Verbose Logging** — Enable debug-level logging for troubleshooting

## Actions

### Recording

- **Recording: Start / Stop Recording** — Start, stop or toggle recording of all windows in the current layout. The disk latch must be locked before the device will start recording
- **Recording: Set Transcoding Method** — Record natively (same encoding as the source), or transcode to H.264 / H.265
- **Recording: Set Forced Time Synchronization** — Enable, disable or toggle forced time synchronization of recordings
- **Recording: Set Scheduled Start / Stop** — Enable or disable a scheduled recording start or stop time (`YYYY-MM-DD HH:MM:SS`, supports variables)

### Layout

- **Layout: Set Layout** — Switch the multiview between the 1 / 4 / 9 split layouts

### Windows

- **Window: Set Source for Window** — Assign a discovered NDI source to a window (or remove the source)
- **Window: Remove Source from Window** — Remove the NDI source from a window
- **Window: Remove Sources from All Windows** — Clear every window of the current layout
- **Window: Set Window Name** — Rename a window (supports variables)
- **Window: Show / Hide Window Video / Audio Meter** — Show, hide or toggle the video and/or audio meter of a window on the multiview
- **Window: Mute / Unmute Window Audio** — Mute, unmute or toggle the monitoring audio of a window
- **Window: Show / Hide All Windows** — Show or hide the video of every window in the current layout

### Sources

- **Sources: Refresh Source Discovery** — Ask the device to rescan the network for NDI sources

### Storage

- **Storage: Set Start Disk** — Select the disk new recordings are written to first
- **Storage: Set Recording File Split Rule** — Split recordings into files by size (GB) or by duration (minutes)

### System

- **System: Set Hostname** — Change the device hostname (supports variables)
- **System: Synchronize Time Now** — Trigger a one-off time synchronization
- **System: Refresh Device Status** — Manually trigger a status refresh

## Feedbacks

- **Recording: Recording is Active** — Active while the device is recording
- **Recording: Transcoding Method is Selected** — Active when the selected transcoding method is configured
- **Layout: Layout is Active** — Active when the selected layout is the current multiview layout
- **Window: Window has Source** — Active when the selected window has the selected (or any) NDI source assigned
- **Window: Window has No Source** — Active when the selected window is empty
- **Window: Window Audio is Muted** — Active when the monitoring audio of the selected window is off
- **Window: Window Video / Audio Meter is Shown or Hidden** — Based on the display state of the window's video or audio meter
- **Window: Window NTP State** — Based on the NTP synchronization state of the source in the selected window
- **Sources: Source is Discovered** — Active when the selected NDI source is currently in the discovery list
- **Storage: Disk State** — Online / offline / unlocked / locked / recording state of the selected disk
- **Storage: Disk Usage Above Threshold** — Active when the used percentage of the selected disk reaches the threshold
- **Storage: Disk is the Start Disk** — Active when the selected disk is the start disk

## Variables

### Device

- **Hostname / Software Version / Firmware Version / IP Address**
- **CPU Usage / GPU Usage / CPU Temperature (°C/°F) / Memory Usage / Network Upload and Download Speed**

### Recording

- **Recording Active / Start Time / Duration / Status Message**
- **Transcoding Method / Forced Time Synchronization**
- **Scheduled Start and Stop (enabled and time)**

### Layout and Sources

- **Current Layout ID / Window Count**
- **Number of Discovered NDI Sources**

### Per Window (window*N*...)

- Name, source name, source IP, bitrate, NTP state, audio on, video shown, audio meter shown

### Storage

- **Start Disk / File Split Rule / File Size Limit / File Duration Limit**
- Per disk (disk*N*...): name, state, unlocked, recording, total, used, usage %, write speed, message

## Presets

- **General** — Refresh, Sync Time, Rescan Sources
- **Recording** — Start, Stop, Toggle and Status buttons with recording feedback; transcoding method buttons
- **Layout** — One button per layout with active-layout feedback
- **Info** — Hostname, version, IP, CPU, memory, temperature, source count
- **Window Sources** — One category per window with a button per discovered NDI source (with assignment feedback) and a remove button
- **Windows** — Audio mute toggles, video toggles and current-source status per window
- **Storage** — Disk status per disk (online / recording feedback) and start-disk selection

Note: window source, window and storage presets are generated from the device once the module is connected. Reload the presets list after the first successful connection.

## Notes

- The module was written against the CUBE R1 HTTP API guide (2023.11). Recording control, layouts, window sources and status monitoring use only documented endpoints. If your firmware behaves differently, enable Verbose Logging and open an issue with the request/response log.
