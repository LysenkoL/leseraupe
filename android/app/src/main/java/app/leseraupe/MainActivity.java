package app.leseraupe;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // eigene Plugins vor super.onCreate anmelden
        registerPlugin(DruckPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
