// google_auth.rs — "Sign in with Google" for the desktop app.
//
// Google refuses to show its sign-in page inside embedded webviews (WebView2
// included), so the page opens in the user's default browser and comes back to
// a one-shot loopback server on 127.0.0.1 (RFC 8252). The web layer builds the
// OpenID Connect implicit request for the game server's public web client id,
// exactly like the Chrome extension; this side only picks a free registered
// port, adds redirect_uri, opens the browser and hands back the response
// parameters. The web layer checks state + nonce, and the game server verifies
// the ID token with Google, so nothing secret lives here.
//
// The ID token comes back in the URL fragment, which browsers never send to a
// server, so the landing page strips it from the address bar and history and
// POSTs it to /done (same origin), then shows the "done" text it gets back.
//
// The web client in Google Cloud must list every LOOPBACK_PORTS entry as an
// authorized redirect URI: http://127.0.0.1:<port>/

use std::io::{ErrorKind, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant};

const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const LOOPBACK_PORTS: [u16; 3] = [53917, 53918, 53919];
const TIMEOUT: Duration = Duration::from_secs(300);

const PAGE_HEAD: &str = "<!doctype html><html><head><meta charset=\"utf-8\">\
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\
<title>Prayer Times Reminder</title></head>\
<body style=\"font:17px/1.6 system-ui,sans-serif;text-align:center;margin:18vh 16px;color:#1f2933;background:#f4f7f5\">";

// Forwards the fragment; a page without one means Google sent nothing back.
const LANDING_BODY: &str = "<div id=\"m\">…</div><script>\
var h=location.hash.slice(1),m=document.getElementById('m');\
history.replaceState(null,'','/');\
if(h){fetch('/done',{method:'POST',body:h}).then(function(r){return r.text();})\
.then(function(t){m.innerHTML=t;},function(){m.textContent='تعذّر الاتصال بالتطبيق. Could not reach the app.';});}\
else{m.textContent='لم يصل ردّ من Google. Google sent no response.';}\
</script></body></html>";

const DONE_TEXT: &str = "<p><b>تم. يمكنك إغلاق هذه الصفحة والعودة إلى التطبيق.</b></p>\
<p>Done. You can close this tab and return to the app.</p>";

/// Runs the browser sign-in. `query` is the auth request without
/// redirect_uri. Returns the response parameters (fragment or query of the
/// redirect) as a query string, or "timeout" / an I/O error.
pub fn sign_in(query: &str) -> Result<String, String> {
    let (listener, port) = bind()?;
    let redirect = format!("http://127.0.0.1:{port}/");
    let url = format!("{AUTH_ENDPOINT}?{query}&redirect_uri={}", encode(&redirect));
    open_browser(&url)?;

    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + TIMEOUT;
    while Instant::now() < deadline {
        match listener.accept() {
            Ok((stream, _)) => {
                if let Some(answer) = serve(stream) {
                    return Ok(answer);
                }
            }
            Err(e) if e.kind() == ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(100)),
            Err(e) => return Err(e.to_string()),
        }
    }
    Err("timeout".into())
}

// The first free registered port (another sign-in may still be waiting).
fn bind() -> Result<(TcpListener, u16), String> {
    for port in LOOPBACK_PORTS {
        if let Ok(l) = TcpListener::bind(("127.0.0.1", port)) {
            return Ok((l, port));
        }
    }
    Err("no-free-port".into())
}

// One request per connection. Some(params) once the redirect has arrived.
fn serve(mut stream: TcpStream) -> Option<String> {
    let _ = stream.set_nonblocking(false);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let request = read_request(&mut stream)?;
    let (head, body) = request.split_once("\r\n\r\n").unwrap_or((request.as_str(), ""));
    let mut line = head.lines().next()?.split_whitespace();
    let method = line.next()?;
    let target = line.next()?;
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    match (method, path) {
        ("GET", "/") if query.contains("error=") => {
            // Some errors come back in the query instead of the fragment.
            respond(stream, "200 OK", &format!("{PAGE_HEAD}{DONE_TEXT}</body></html>"));
            Some(query.to_string())
        }
        ("GET", "/") => {
            respond(stream, "200 OK", &format!("{PAGE_HEAD}{LANDING_BODY}"));
            None
        }
        ("POST", "/done") => {
            respond(stream, "200 OK", DONE_TEXT);
            Some(body.trim().to_string())
        }
        _ => {
            respond(stream, "404 Not Found", "");
            None
        }
    }
}

// The head plus a body of up to Content-Length bytes (a POST may arrive in
// more than one packet).
fn read_request(stream: &mut TcpStream) -> Option<String> {
    let mut data = Vec::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = stream.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        data.extend_from_slice(&buf[..n]);
        let text = String::from_utf8_lossy(&data);
        if let Some((head, body)) = text.split_once("\r\n\r\n") {
            let want = head
                .lines()
                .find_map(|l| {
                    let l = l.to_ascii_lowercase();
                    l.strip_prefix("content-length:").map(|v| v.trim().to_string())
                })
                .and_then(|v| v.parse::<usize>().ok())
                .unwrap_or(0);
            if body.len() >= want {
                break;
            }
        }
        if data.len() > 64 * 1024 {
            return None;
        }
    }
    Some(String::from_utf8_lossy(&data).into_owned())
}

fn respond(mut stream: TcpStream, status: &str, html: &str) {
    let head = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\
Cache-Control: no-store\r\nConnection: close\r\n\r\n",
        html.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(html.as_bytes());
    let _ = stream.flush();
}

// rundll32 hands the URL straight to the default browser; going through
// `cmd /C start` would split it at every '&'.
pub(crate) fn open_browser(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    std::process::Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", url])
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(not(windows))]
    let _ = url;
    Ok(())
}

// Percent-encodes a query value (RFC 3986 unreserved characters pass).
fn encode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}
