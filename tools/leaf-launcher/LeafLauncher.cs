using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

class Program
{
    [DllImport("kernel32.dll", SetLastError = true, ExactSpelling = true)]
    static extern bool FreeConsole();

    static string logFile = Path.Combine(Path.GetTempPath(), "leaf-launcher.log");

    static void Log(string msg)
    {
        for (int i = 0; i < 5; i++)
        {
            try
            {
                using (var fs = new FileStream(logFile, FileMode.Append, FileAccess.Write, FileShare.ReadWrite))
                using (var sw = new StreamWriter(fs))
                {
                    sw.WriteLine(string.Format("[{0}] {1}", DateTime.Now.ToString("HH:mm:ss.fff"), msg));
                    break;
                }
            }
            catch { System.Threading.Thread.Sleep(20); }
        }
    }

    static void Main(string[] args)
    {
        FreeConsole();

        if (args.Length == 0) return;
        string raw = (args.Length == 1 ? args[0] : string.Join(" ", args)).Trim();
        raw = raw.Trim('"', '\'');
        Log("Main called with: " + raw);

        try
        {
            // 1. Unescape URI and clean slashes
            if (raw.StartsWith("file:///", StringComparison.OrdinalIgnoreCase))
                raw = raw.Substring(8);
            else if (raw.StartsWith("file://", StringComparison.OrdinalIgnoreCase))
                raw = raw.Substring(7);

            raw = Uri.UnescapeDataString(raw);
            Log("Unescaped to: " + raw);

            // Try opening inside Herdr as a split pane first
            bool openedInHerdr = TryOpenInHerdr(raw);
            Log("openedInHerdr result: " + openedInHerdr);
            if (!openedInHerdr)
            {
                OpenInWindowsTerminal(raw);
            }
        }
        catch (Exception ex)
        {
            Log("Main exception: " + ex.ToString());
            OpenInWindowsTerminal(raw);
        }
    }

    static bool TryOpenInHerdr(string raw)
    {
        Log("Entering TryOpenInHerdr");
        try
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string herdrPath = Path.Combine(localAppData, @"Programs\herdr-app\herdr-app.exe");
            if (!File.Exists(herdrPath))
            {
                Log("herdrPath does not exist: " + herdrPath);
                return false;
            }

            // Check herdr status
            ProcessStartInfo psiStatus = new ProcessStartInfo();
            psiStatus.FileName = herdrPath;
            psiStatus.Arguments = "status";
            psiStatus.UseShellExecute = false;
            psiStatus.RedirectStandardOutput = true;
            psiStatus.RedirectStandardError = false;
            psiStatus.CreateNoWindow = true;

            using (Process pStatus = Process.Start(psiStatus))
            {
                if (pStatus == null)
                {
                    Log("pStatus is null");
                    return false;
                }
                string json = pStatus.StandardOutput.ReadToEnd();
                pStatus.WaitForExit(1500);
                Log("Status json: " + json.Replace("\r", "").Replace("\n", " "));

                if (pStatus.ExitCode != 0 || string.IsNullOrEmpty(json))
                {
                    Log("Status exit code " + pStatus.ExitCode + " or empty json");
                    return false;
                }

                bool isWsl = json.Contains("\"space\": \"wsl/") || json.Contains("\"space\":\"wsl/");
                Log("isWsl: " + isWsl);

                string targetPath;
                if (isWsl)
                {
                    targetPath = ToLinuxPath(raw);
                }
                else
                {
                    targetPath = ToWindowsPath(raw);
                }
                Log("targetPath: " + targetPath);

                // Escape for argv JSON
                string escapedPath = targetPath.Replace("\\", "\\\\").Replace("\"", "\\\"");

                ProcessStartInfo psiSplit = new ProcessStartInfo();
                psiSplit.FileName = herdrPath;
                psiSplit.Arguments = string.Format("do pane.split --direction right --argv \"[\\\"leaf\\\", \\\"{0}\\\"]\"", escapedPath);
                psiSplit.UseShellExecute = false;
                psiSplit.RedirectStandardOutput = true;
                psiSplit.RedirectStandardError = false;
                psiSplit.CreateNoWindow = true;

                Log("Running: " + psiSplit.FileName + " " + psiSplit.Arguments);

                using (Process pSplit = Process.Start(psiSplit))
                {
                    if (pSplit == null)
                    {
                        Log("pSplit is null");
                        return false;
                    }
                    string res = pSplit.StandardOutput.ReadToEnd();
                    pSplit.WaitForExit(3000);
                    Log(string.Format("Split exit {0}, res: {1}", pSplit.ExitCode, res.Trim()));
                    return pSplit.ExitCode == 0 && res.Contains("\"pane\"");
                }
            }
        }
        catch (Exception ex)
        {
            Log("TryOpenInHerdr exception: " + ex.ToString());
            return false;
        }
    }

    static string ToLinuxPath(string raw)
    {
        string p = raw.Replace('\\', '/');

        // Strip any leading slashes (e.g. from "//wsl.localhost" or "/wsl.localhost")
        while (p.StartsWith("/"))
            p = p.Substring(1);

        // Handle wsl.localhost/<distro>/ or wsl$/<distro>/
        if (p.StartsWith("wsl.localhost/", StringComparison.OrdinalIgnoreCase))
        {
            int slash = p.IndexOf('/', "wsl.localhost/".Length);
            if (slash != -1)
                return p.Substring(slash); // e.g. "/home/andrej/..."
            return "/" + p.Substring("wsl.localhost/".Length);
        }
        if (p.StartsWith("wsl$/", StringComparison.OrdinalIgnoreCase))
        {
            int slash = p.IndexOf('/', "wsl$/".Length);
            if (slash != -1)
                return p.Substring(slash);
            return "/" + p.Substring("wsl$/".Length);
        }

        // Handle C:/home/ or home/ -> /home/
        if (p.StartsWith("C:/home/", StringComparison.OrdinalIgnoreCase))
            return "/" + p.Substring("C:/".Length);
        if (p.StartsWith("home/", StringComparison.OrdinalIgnoreCase))
            return "/" + p;

        // Handle C:/mnt/c/ -> /mnt/c/
        if (p.StartsWith("C:/mnt/c/", StringComparison.OrdinalIgnoreCase))
            return "/mnt/c/" + p.Substring("C:/mnt/c/".Length);

        // Handle Windows drive: C:/... -> /mnt/c/...
        if (p.Length >= 2 && p[1] == ':')
        {
            char drive = char.ToLowerInvariant(p[0]);
            string rest = p.Length > 2 ? p.Substring(2) : "";
            if (!rest.StartsWith("/")) rest = "/" + rest;
            return "/mnt/" + drive + rest;
        }

        if (!p.StartsWith("/"))
            p = "/" + p;

        return p;
    }

    static string ToWindowsPath(string raw)
    {
        string p = raw.Replace('/', '\\');

        while (p.StartsWith("\\"))
            p = p.Substring(1);

        if (p.StartsWith("wsl.localhost\\", StringComparison.OrdinalIgnoreCase) || p.StartsWith("wsl$\\", StringComparison.OrdinalIgnoreCase))
            return "\\\\" + p;

        if (p.StartsWith("home\\", StringComparison.OrdinalIgnoreCase))
            return @"C:\home\" + p.Substring(5);

        if (p.StartsWith("mnt\\c\\", StringComparison.OrdinalIgnoreCase))
            return @"C:\" + p.Substring(6);

        if (p.Length >= 5 && p.StartsWith("mnt\\", StringComparison.OrdinalIgnoreCase) && p[5] == '\\')
        {
            char drive = char.ToUpperInvariant(p[4]);
            return drive + @":\" + p.Substring(6);
        }

        return p;
    }

    static void OpenInWindowsTerminal(string raw)
    {
        string winPath = ToWindowsPath(raw);
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string leafPath = Path.Combine(localAppData, @"Programs\leaf\leaf.exe");
        if (!File.Exists(leafPath))
        {
            string binLeaf = Path.Combine(userProfile, @"bin\leaf.exe");
            if (File.Exists(binLeaf)) leafPath = binLeaf;
            else leafPath = "leaf";
        }
        string wtPath = Path.Combine(localAppData, @"Microsoft\WindowsApps\wt.exe");

        ProcessStartInfo psi = new ProcessStartInfo();
        if (File.Exists(wtPath))
        {
            psi.FileName = wtPath;
            psi.Arguments = string.Format("--title leaf \"{0}\" \"{1}\"", leafPath, winPath);
        }
        else
        {
            psi.FileName = leafPath;
            psi.Arguments = string.Format("\"{0}\"", winPath);
        }
        psi.UseShellExecute = true;
        Process.Start(psi);
    }
}
