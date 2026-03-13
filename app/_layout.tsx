import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppThemeProvider, useAppTheme } from "@/context/ThemeContext";
import { initializeDatabase } from "@/database/client";
import { seedDatabase } from "@/database/seed";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

function RootLayoutNav() {
  const { t, theme, language } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme === "dark" ? "#121212" : "#fff" },
        headerTintColor: theme === "dark" ? "#fff" : "#000",
      }}
    >

      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="admin/index" options={{ title: t.ADMIN }} />
      <Stack.Screen name="shop" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </AppThemeProvider>
  );
}

function RootLayoutInner() {
  const { theme } = useAppTheme();

  useEffect(() => {
    // Initialize SQLite database on app startup
    const initApp = async () => {
      try {
        await initializeDatabase();
        await seedDatabase();
      } catch (error) {
        console.error("Failed to initialize app:", error);
      }
    };

    initApp();
  }, []);

  return (
    <ThemeProvider value={theme === "dark" ? DarkTheme : DefaultTheme}>
      <RootLayoutNav />
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}
