package com.akw.workspace;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkspaceBridge.class);
        super.onCreate(savedInstanceState);
    }
}
