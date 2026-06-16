# companion-module-kiloview-cuber1

Bitfocus Companion module for Kiloview CUBE R1 multi-channel NDI recorder.

## Features

- Control layout switching (1/4/9 split)
- Assign NDI sources to positions
- Start/stop recording (all channels or single channel)
- Switch between Record and Director modes
- Manage NDI source discovery
- Set channel names
- Audio line-in configuration
- Storage management (format disk, NAS, FTP)
- System monitoring (CPU, GPU, memory, temperature)

## Configuration

- **Device IP / Host** — IP address or hostname of the CUBE R1
- **Port** — HTTP port (default: 80)
- **Use Authentication** — Enable/disable login (default: enabled)
- **Username / Password** — Login credentials (default: admin/admin)
- **Default Layout** — Initial layout (1/4/9 split)
- **Enable Polling** — Enable state polling for feedbacks and variables
- **Polling Rate** — State polling interval in ms (default: 1000)
- **Polling Rate for Sources** — NDI source discovery interval in ms (default: 10000)
- **Verbose Logging** — Enable debug logging

## Requirements

- Node.js 18+
- Bitfocus Companion v3+

## License

MIT