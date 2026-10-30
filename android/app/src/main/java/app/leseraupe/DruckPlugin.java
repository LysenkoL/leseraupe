package app.leseraupe;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PdfAusWebView;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;

import androidx.lifecycle.Lifecycle;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Drucken und PDF in der Android-App. window.print() geht in der WebView nicht.
 * Die App legt die Blätter in #print-root (wie im Browser), dann druckt Android die Seite
 * der WebView mit print.css: jedes Blatt auf eigener A4-Seite, Text als Text (scharf und schnell).
 */
@CapacitorPlugin(name = "Druck")
public class DruckPlugin extends Plugin {

    /** Die WebView kann nur einen Druck gleichzeitig – ein zweiter lässt die App abstürzen. */
    private boolean beschaeftigt = false;

    private static PrintAttributes a4() {
        return new PrintAttributes.Builder()
            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
            .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
            .setResolution(new PrintAttributes.Resolution("pdf", "pdf", 600, 600))
            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
            .build();
    }

    /** Ist die App gerade nicht vorne (Display aus, App gewechselt), blockiert Android das Druckmenü ohne Meldung. */
    private boolean sichtbar() {
        return getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED);
    }

    /** Gibt den Druck frei, sobald Android mit dem Auftrag fertig ist (gedruckt oder abgebrochen). */
    private PrintDocumentAdapter mitEnde(PrintDocumentAdapter a) {
        return new PrintDocumentAdapter() {
            @Override
            public void onStart() {
                a.onStart();
            }

            @Override
            public void onLayout(PrintAttributes alt, PrintAttributes neu, CancellationSignal abbruch,
                                 LayoutResultCallback callback, Bundle extras) {
                a.onLayout(alt, neu, abbruch, callback, extras);
            }

            @Override
            public void onWrite(PageRange[] seiten, ParcelFileDescriptor ziel, CancellationSignal abbruch,
                                WriteResultCallback callback) {
                a.onWrite(seiten, ziel, abbruch, callback);
            }

            @Override
            public void onFinish() {
                a.onFinish();
                beschaeftigt = false;
            }
        };
    }

    @PluginMethod
    public void seiteDrucken(PluginCall call) {
        String name = call.getString("name", "Leseblatt");
        getActivity().runOnUiThread(() -> {
            if (beschaeftigt) {
                call.reject("Es wird schon gedruckt", "BESCHAEFTIGT");
                return;
            }
            if (!sichtbar()) {
                call.reject("App ist nicht auf dem Bildschirm", "NICHT_SICHTBAR");
                return;
            }
            beschaeftigt = true;
            PrintDocumentAdapter adapter = mitEnde(getBridge().getWebView().createPrintDocumentAdapter(name));
            PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            pm.print(name, adapter, a4());
            call.resolve();
        });
    }

    /** Dieselbe Seite als A4-PDF-Datei (für „Als PDF teilen“); Rückgabe als Base64. */
    @PluginMethod
    public void seiteAlsPdf(PluginCall call) {
        String name = call.getString("name", "Leseblatt");
        File ziel = new File(getContext().getCacheDir(), "seite.pdf");
        getActivity().runOnUiThread(() -> {
            if (beschaeftigt) {
                call.reject("Es wird schon gedruckt", "BESCHAEFTIGT");
                return;
            }
            beschaeftigt = true;
            PrintDocumentAdapter adapter = getBridge().getWebView().createPrintDocumentAdapter(name);
            PdfAusWebView.schreiben(adapter, a4(), ziel, new PdfAusWebView.Ergebnis() {
                @Override
                public void fertig() {
                    beschaeftigt = false;
                    try (InputStream in = new FileInputStream(ziel); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                        byte[] buf = new byte[16384];
                        int n;
                        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                        JSObject r = new JSObject();
                        r.put("pdf", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                        call.resolve(r);
                    } catch (IOException e) {
                        call.reject("PDF konnte nicht gelesen werden", e);
                    }
                }

                @Override
                public void fehler(String meldung) {
                    beschaeftigt = false;
                    call.reject("PDF fehlgeschlagen: " + meldung);
                }
            });
        });
    }
}
