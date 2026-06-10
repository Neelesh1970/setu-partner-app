# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# react-native-config
-keep class com.setu_lab_test.BuildConfig { *; }

# Razorpay
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.razorpay.** { *; }

# BLE
-keep class com.polidea.reactnativeble.** { *; }

# Vision Camera
-keep class com.mrousavy.camera.** { *; }

# Reanimated / Gesture Handler (if present)
-keep class com.swmansion.** { *; }
