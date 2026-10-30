package app.leseraupe;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;

import androidx.lifecycle.Lifecycle;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Drucken über das Android-Druckmenü (PrintManager). window.print() geht in der WebView nicht.
 * Die App schickt ein fertiges PDF (jede Seite genau A4, wie „Als PDF teilen“),
 * es wird ohne Skalierung an den Drucker gegeben. Papier ist auf A4 voreingestellt.
 */
@CapacitorPlugin(name = "Druck")
public class DruckPlugin extends Plugin {

    @PluginMethod
    public void pdfDrucken(PluginCall call) {
        String pdf = call.getString("pdf");
        String name = call.getString("name", "Leseblatt");
        int seiten = call.getInt("seiten", PrintDocumentInfo.PAGE_COUNT_UNKNOWN);
        if (pdf == null) {
            call.reject("Kein PDF");
            return;
        }
        File datei = new File(getContext().getCacheDir(), "druck.pdf");
        try (OutputStream out = new FileOutputStream(datei)) {
            out.write(Base64.decode(pdf, Base64.DEFAULT));
        } catch (IOException e) {
            call.reject("PDF konnte nicht gespeichert werden", e);
            return;
        }
        PrintAttributes a4 = new PrintAttributes.Builder()
            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
            .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
            .build();
        getActivity().runOnUiThread(() -> {
            // Ist die App gerade nicht vorne (Display aus, App gewechselt), blockiert Android das Druckmenü
            // ohne Meldung. Dann lieber ehrlich zurückmelden, die App bittet um einen neuen Tipp.
            if (!getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)) {
                call.reject("App ist nicht auf dem Bildschirm", "NICHT_SICHTBAR");
                return;
            }
            PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            pm.print(name, new PdfAdapter(datei, name, seiten), a4);
            call.resolve();
        });
    }

    private static class PdfAdapter extends PrintDocumentAdapter {
        private final File datei;
        private final String name;
        private final int seiten;

        PdfAdapter(File datei, String name, int seiten) {
            this.datei = datei;
            this.name = name;
            this.seiten = seiten;
        }

        @Override
        public void onLayout(PrintAttributes alt, PrintAttributes neu, CancellationSignal abbruch,
                             LayoutResultCallback callback, Bundle extras) {
            if (abbruch.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }
            PrintDocumentInfo info = new PrintDocumentInfo.Builder(name + ".pdf")
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                .setPageCount(seiten)
                .build();
            // Inhalt hängt nicht vom gewählten Papier ab: immer dasselbe A4-PDF
            callback.onLayoutFinished(info, false);
        }

        @Override
        public void onWrite(PageRange[] seitenAuswahl, ParcelFileDescriptor ziel, CancellationSignal abbruch,
                            WriteResultCallback callback) {
            try (InputStream in = new FileInputStream(datei);
                 OutputStream out = new FileOutputStream(ziel.getFileDescriptor())) {
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) {
                    if (abbruch.isCanceled()) {
                        callback.onWriteCancelled();
                        return;
                    }
                    out.write(buf, 0, n);
                }
                callback.onWriteFinished(new PageRange[] { PageRange.ALL_PAGES });
            } catch (IOException e) {
                callback.onWriteFailed(e.getMessage());
            }
        }
    }
}
