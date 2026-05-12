// Proxy: route via Squid sidecar (no auth from Firefox side)
user_pref("network.proxy.type", 1);
user_pref("network.proxy.http", "squid-sidecar");
user_pref("network.proxy.http_port", 3128);
user_pref("network.proxy.ssl", "squid-sidecar");
user_pref("network.proxy.ssl_port", 3128);
user_pref("network.proxy.share_proxy_settings", true);
user_pref("network.proxy.no_proxies_on", "localhost,127.0.0.1");
user_pref("network.proxy.allow_hijacking_localhost", false);

// Mobile User-Agent: iPhone Safari iOS 17 → FB serves m.facebook.com
user_pref("general.useragent.override", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");

// Mobile viewport
user_pref("layout.css.devPixelsPerPx", "1.0");

// Privacy
user_pref("toolkit.telemetry.enabled", false);
user_pref("datareporting.healthreport.uploadEnabled", false);
user_pref("app.shield.optoutstudies.enabled", false);
user_pref("browser.safebrowsing.enabled", false);

// Homepage
user_pref("browser.startup.homepage", "https://m.facebook.com/login");
