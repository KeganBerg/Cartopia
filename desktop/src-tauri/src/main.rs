// Cartopia for desktop: a window that plays the live game at cartopia.lol, so every
// deploy reaches desktop players the moment it ships and the app itself rarely changes.
// The window first shows shell/index.html, which checks the connection and then moves
// on to the game, or shows the offline screen until the connection is back.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::utils::config::BackgroundThrottlingPolicy;
use tauri::{WebviewUrl, WebviewWindowBuilder};

const GAME_URL: &str = "https://cartopia.lol";

fn main() {
    // CARTOPIA_URL points the app at another copy of the game, such as a local test build.
    let game = std::env::var("CARTOPIA_URL").unwrap_or_else(|_| GAME_URL.into());
    // Runs on every page the window opens: the loader reads the game address, and F11 works in the game.
    let script = format!("window.__CARTOPIA_URL__ = {:?};\n{}", game, include_str!("desktop.js"));

    tauri::Builder::default()
        .setup(move |app| {
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Cartopia")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 500.0)
                .resizable(true)
                .center()
                .maximized(true)
                .initialization_script(&script)
                // Music never pauses, even while the window is minimised or behind another.
                .background_throttling(BackgroundThrottlingPolicy::Disabled);
            // Tauri's own defaults, plus music and sounds that start without waiting for a click.
            #[cfg(windows)]
            let window = window.additional_browser_args(
                "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required",
            );
            window.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Cartopia could not start");
}
