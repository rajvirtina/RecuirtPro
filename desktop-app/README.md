# RecuirtPro Desktop Monitor

Desktop application for monitoring candidates during interviews.

## Features

- ✅ Real-time process detection (TeamViewer, AnyDesk, UltraViewer, etc.)
- ✅ Multiple display detection
- ✅ Window focus monitoring
- ✅ Real-time violation reporting to backend
- ✅ WebSocket communication for instant HR alerts
- ✅ Auto-update functionality
- ✅ System tray integration
- ✅ Cross-platform support (Windows & macOS)

## Installation

### 1. Install Dependencies

```powershell
cd desktop-app
npm install
```

### 2. Development

```powershell
# Run in development mode
npm run dev

# Start only main process
npm run dev:main

# Start only renderer process
npm run dev:renderer
```

### 3. Build

```powershell
# Build TypeScript files
npm run build

# Package for current platform
npm run package

# Package for Windows only
npm run package:win

# Package for macOS only
npm run package:mac
```

## Project Structure

```
desktop-app/
├── src/
│   ├── main/                 # Main Electron process
│   │   ├── main.ts           # Entry point
│   │   ├── monitors/         # Monitoring modules
│   │   │   ├── ProcessMonitor.ts
│   │   │   ├── DisplayMonitor.ts
│   │   │   └── WindowMonitor.ts
│   │   └── services/         # API communication
│   │       ├── ApiClient.ts
│   │       └── SocketClient.ts
│   ├── preload/              # Preload scripts
│   │   └── preload.ts
│   └── renderer/             # Renderer process (UI)
│       ├── index.html
│       └── renderer.ts
├── dist/                     # Compiled files
├── release/                  # Packaged installers
├── package.json
└── tsconfig.json
```

## Configuration

The app requires the following configuration:

- **API URL**: Backend API endpoint (default: `http://localhost:5001/api/v1`)
- **Auth Token**: JWT token for authentication
- **Interview ID**: ID of the interview being monitored
- **Candidate ID**: ID of the candidate

## Packaging & Distribution

### Windows

Generates:
- `RecuirtPro-Monitor-Setup-{version}.exe` (NSIS installer)
- `RecuirtPro-Monitor-{version}.msi` (Windows Installer)

### macOS

Generates:
- `RecuirtPro-Monitor-{version}.dmg` (Disk Image)
- `RecuirtPro-Monitor-{version}.zip` (Archive)

### Code Signing

**Windows:**
```powershell
# Set environment variables
$env:CSC_LINK = "path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD = "certificate_password"
npm run package:win
```

**macOS:**
```bash
# Set environment variables
export CSC_LINK="/path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate_password"
export APPLE_ID="your@apple.id"
export APPLE_ID_PASSWORD="app-specific-password"
npm run package:mac
```

## Monitoring Capabilities

### Process Detection

Detects running instances of:
- TeamViewer
- AnyDesk
- UltraViewer
- VNC (all variants)
- Remote Desktop (RDP)
- Chrome Remote Desktop
- Other remote access tools

### Display Monitoring

- Detects connection/disconnection of additional monitors
- Reports when multiple displays are active
- Captures display configuration changes

### Window Focus Tracking

- Monitors browser window focus state
- Detects when candidate switches away from interview
- Tracks active application changes

## API Integration

### HTTP Endpoints

- `POST /proctoring/event` - Report violations
- `POST /proctoring/heartbeat` - Send periodic status updates
- `GET /interviews/:id/status` - Check interview status

### WebSocket Events

- `violation` - Real-time violation reporting
- `interview-terminated` - Server terminates interview
- `interview-warning` - Server sends warning

## Auto-Update

The app automatically checks for updates on startup. Updates are downloaded in the background and installed on restart.

Update server configuration is in `package.json`:
```json
{
  "publish": {
    "provider": "generic",
    "url": "https://updates.recuritpro.com"
  }
}
```

## System Requirements

### Windows
- Windows 10 or later
- 2 GB RAM minimum
- .NET Framework 4.5+

### macOS
- macOS 10.13 or later
- 2 GB RAM minimum
- Apple Silicon (M1/M2) or Intel support

## Security & Privacy

- **Process Name Only**: Only process names are monitored, not content
- **Encrypted Communication**: All data transmitted over HTTPS/WSS
- **User Consent**: Clear disclosure modal before monitoring starts
- **Data Retention**: Configurable retention policies
- **No Screenshots**: No screen capture or recording capabilities

## Troubleshooting

### App Won't Start

1. Check logs: `%APPDATA%\recuritpro-desktop-monitor\logs` (Windows) or `~/Library/Logs/recuritpro-desktop-monitor` (macOS)
2. Run in development mode: `npm run dev`
3. Check console for errors

### Process Detection Not Working

1. Ensure app has admin privileges (Windows) or accessibility permissions (macOS)
2. Check prohibited process list in `main.ts`
3. Verify process names match exactly (case-insensitive)

### WebSocket Connection Failed

1. Verify API URL is correct
2. Check firewall settings
3. Ensure backend WebSocket server is running
4. Check authentication token validity

## Development Notes

### Adding New Prohibited Processes

Edit `src/main/main.ts`:

```typescript
prohibitedProcesses: [
  'teamviewer.exe',
  'new-app.exe',  // Add here
  // ...
]
```

### Custom Violation Types

Edit `src/main/main.ts` and add new violation handlers:

```typescript
handleCustomViolation(data: any) {
  handleViolation({
    type: 'CUSTOM_VIOLATION',
    timestamp: Date.now(),
    severity: 'high',
  });
}
```

## License

Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.

## Support

For technical support, contact: support@recuritpro.com
