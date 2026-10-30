package android.print;

import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.IOException;

/**
 * Druckauftrag der WebView direkt in eine PDF-Datei schreiben, ohne Druckmenü.
 * Liegt im Paket android.print, weil die Rückruf-Klassen von PrintDocumentAdapter
 * nur von dort aus erzeugt werden können.
 */
public class PdfAusWebView {

    public interface Ergebnis {
        void fertig();

        void fehler(String meldung);
    }

    public static void schreiben(PrintDocumentAdapter adapter, PrintAttributes attrs, File ziel, Ergebnis ergebnis) {
        adapter.onStart();
        adapter.onLayout(null, attrs, new CancellationSignal(), new PrintDocumentAdapter.LayoutResultCallback() {
            @Override
            public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                final ParcelFileDescriptor fd;
                try {
                    fd = ParcelFileDescriptor.open(ziel,
                        ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_TRUNCATE | ParcelFileDescriptor.MODE_READ_WRITE);
                } catch (IOException e) {
                    adapter.onFinish();
                    ergebnis.fehler(e.getMessage());
                    return;
                }
                adapter.onWrite(new PageRange[] { PageRange.ALL_PAGES }, fd, new CancellationSignal(),
                    new PrintDocumentAdapter.WriteResultCallback() {
                        @Override
                        public void onWriteFinished(PageRange[] pages) {
                            schliessen(fd);
                            adapter.onFinish();
                            ergebnis.fertig();
                        }

                        @Override
                        public void onWriteFailed(CharSequence error) {
                            schliessen(fd);
                            adapter.onFinish();
                            ergebnis.fehler(String.valueOf(error));
                        }

                        @Override
                        public void onWriteCancelled() {
                            schliessen(fd);
                            adapter.onFinish();
                            ergebnis.fehler("abgebrochen");
                        }
                    });
            }

            @Override
            public void onLayoutFailed(CharSequence error) {
                adapter.onFinish();
                ergebnis.fehler(String.valueOf(error));
            }
        }, null);
    }

    private static void schliessen(ParcelFileDescriptor fd) {
        try {
            fd.close();
        } catch (IOException ignored) {
            // nichts zu tun
        }
    }
}
