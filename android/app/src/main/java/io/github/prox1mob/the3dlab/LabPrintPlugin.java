package io.github.prox1mob.the3dlab;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android WebView ignores window.print(). This plugin opens the system print dialog
 * for the current page, where the user can print or "Save as PDF".
 */
@CapacitorPlugin(name = "LabPrint")
public class LabPrintPlugin extends Plugin {

    @PluginMethod
    public void print(final PluginCall call) {
        final String name = call.getString("name", "The 3D Lab");
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                if (webView == null || printManager == null) {
                    call.reject("Printing is not available on this device.");
                    return;
                }
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(name);
                printManager.print(name, adapter, new PrintAttributes.Builder().build());
                call.resolve();
            } catch (Exception e) {
                call.reject("Printing failed: " + e.getMessage());
            }
        });
    }
}
