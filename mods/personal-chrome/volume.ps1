param(
    [ValidateSet('get', 'set')][string]$Action = 'get',
    [ValidateRange(0, 100)][int]$Level = 100,
    [string]$ProcessName = 'herdr-app'
)
$ErrorActionPreference = 'Stop'
trap {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

[Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"), ComImport]
class MMDeviceEnumerator {}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IMMDeviceCollection ppDevices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
}

[Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection {
    int GetCount(out int pcDevices);
    int Item(int nDevice, out IMMDevice ppDevice);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}

[Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionManager2 {
    int _GetAudioSessionControl(IntPtr a, int b, out IntPtr c);
    int _GetSimpleAudioVolume(IntPtr a, int b, out IntPtr c);
    int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
}

[Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionEnumerator {
    int GetCount(out int SessionCount);
    int GetSession(int SessionCount, out IAudioSessionControl Session);
}

[Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl {
    int GetState(out int pRetVal);
}

[Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl2 {
    int _s1(); int _s2(); int _s3(); int _s4(); int _s5(); int _s6(); int _s7(); int _s8(); int _s9();
    int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
    int GetProcessId(out uint pRetVal);
}

[Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface ISimpleAudioVolume {
    int SetMasterVolume(float fLevel, ref Guid EventContext);
    int GetMasterVolume(out float pfLevel);
    int SetMute(bool bMute, ref Guid EventContext);
    int GetMute(out bool pbMute);
}

public static class HerdrAudioVolume {
    public static int[] Handle(string action, int level, string processName) {
        var pids = new HashSet<uint>();
        foreach (var proc in Process.GetProcessesByName(processName)) {
            pids.Add((uint)proc.Id);
        }
        if (pids.Count == 0) return new int[] { 0, 100, 0 };

        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
        var devices = new List<IMMDevice>();
        try {
            IMMDevice def;
            if (enumerator.GetDefaultAudioEndpoint(0, 1, out def) == 0 && def != null) {
                devices.Add(def);
            }
        } catch {}
        try {
            IMMDeviceCollection col;
            if (enumerator.EnumAudioEndpoints(0, 1, out col) == 0 && col != null) {
                int devCount;
                col.GetCount(out devCount);
                for (int d = 0; d < devCount; d++) {
                    IMMDevice dev;
                    if (col.Item(d, out dev) == 0 && dev != null) devices.Add(dev);
                }
            }
        } catch {}

        var mgrIid = typeof(IAudioSessionManager2).GUID;
        Guid ctx = Guid.Empty;
        bool found = false;
        int outVolume = 100;
        bool outMuted = false;

        foreach (var device in devices) {
            object mgrObj;
            try {
                if (device.Activate(ref mgrIid, 23, IntPtr.Zero, out mgrObj) != 0 || mgrObj == null) continue;
            } catch { continue; }
            var mgr = (IAudioSessionManager2)mgrObj;
            IAudioSessionEnumerator sessionEnum;
            if (mgr.GetSessionEnumerator(out sessionEnum) != 0 || sessionEnum == null) continue;
            int count;
            sessionEnum.GetCount(out count);
            for (int i = 0; i < count; i++) {
                IAudioSessionControl ctrl;
                if (sessionEnum.GetSession(i, out ctrl) != 0 || ctrl == null) continue;
                uint pid;
                ((IAudioSessionControl2)ctrl).GetProcessId(out pid);
                if (!pids.Contains(pid)) continue;
                var vol = (ISimpleAudioVolume)ctrl;
                if (action == "set") {
                    float target = Math.Max(0f, Math.Min(1f, level / 100f));
                    vol.SetMasterVolume(target, ref ctx);
                }
                float current;
                bool muted;
                vol.GetMasterVolume(out current);
                vol.GetMute(out muted);
                if (!found) {
                    found = true;
                    outVolume = (int)Math.Round(current * 100f);
                    outMuted = muted;
                }
            }
            if (found && action == "get") break;
        }
        return new int[] { found ? 1 : 0, outVolume, outMuted ? 1 : 0 };
    }
}
"@

$res = [HerdrAudioVolume]::Handle($Action, $Level, $ProcessName)
@{
    found = ($res[0] -eq 1)
    volume = if ($res[0] -eq 1) { $res[1] } else { $null }
    muted = if ($res[0] -eq 1) { $res[2] -eq 1 } else { $null }
} | ConvertTo-Json -Compress
