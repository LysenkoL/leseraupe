package app.leseraupe;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // eigene Plugins vor super.onCreate anmelden
        registerPlugin(DruckPlugin.class);
        super.onCreate(savedInstanceState);

        // Android-Zurück (Taste oder Geste): die App entscheidet (src/app/zurueck.ts).
        // Ohne das schließt Android die App von jedem Bildschirm aus.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = bridge != null ? bridge.getWebView() : null;
                if (web == null) {
                    systemZurueck();
                    return;
                }
                web.evaluateJavascript(
                    "(function(){try{return !!(window.__zurueck && window.__zurueck());}catch(e){return false;}})()",
                    erledigt -> {
                        if (!"true".equals(erledigt)) systemZurueck();
                    }
                );
            }

            /** Startseite: wie üblich – Android legt die App in den Hintergrund */
            private void systemZurueck() {
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
