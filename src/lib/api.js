import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.4:5000/api";
  

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

let cachedToken = null;

/* =========================
   TOKEN MANAGEMENT
========================= */

export const setAuthToken = async (token) => {
  cachedToken = token || null;

  if (token) {
    await AsyncStorage.setItem("userToken", token);
  } else {
    await AsyncStorage.removeItem("userToken");
  }
};

export const getStoredToken = async () => {
  if (cachedToken) {
    return cachedToken;
  }

  const token = await AsyncStorage.getItem("userToken");

  if (token) {
    cachedToken = token;
  }

  return token || null;
};

export const clearTokenCache = () => {
  cachedToken = null;
};

/* =========================
   USER PROFILE
========================= */

export const saveUser = async (user) => {
  if (user) {
    await AsyncStorage.setItem("userProfile", JSON.stringify(user));
  }
};

export const getStoredUser = async () => {
  const user = await AsyncStorage.getItem("userProfile");

  if (!user) {
    return null;
  }

  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
};

/* =========================
   API ERROR
========================= */

export const getApiErrorMessage = (
  error,
  fallback = "Something went wrong",
) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

/* =========================
   REQUEST INTERCEPTOR
========================= */

api.interceptors.request.use(
  async (config) => {
    const token = await getStoredToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/* =========================
   RESPONSE INTERCEPTOR
========================= */

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    if (error.response) {
      const status = error.response.status;

      if (status === 401) {
        await logoutUser();
      }

      return Promise.reject({
        status,
        message:
          error.response.data?.message ||
          error.response.data?.error ||
          "Server error",
        data: error.response.data,
      });
    }

    return Promise.reject({
      status: "network_error",
      message:
        "Network connection failed. Please check your internet connection.",
    });
  },
);

/* =========================
   LOGIN
========================= */

export const loginWithIdentifier = async (identifier, password) => {
  try {
    const response = await api.post("/users/login", {
      identifier: String(identifier || "").trim(),
      password: String(password || ""),
    });

    const data = response.data || {};

    if (data.token) {
      await setAuthToken(data.token);
    }

    if (data.user) {
      await saveUser(data.user);
    }

    return {
      ...data,
      message: data.message || "Login successful",
    };
  } catch (error) {
    throw error;
  }
};

/* =========================
   REGISTRATION
========================= */

export const registerUser = async ({ username, email, phone, password }) => {
  const response = await api.post("/auth/register", {
    username: String(username || "").trim(),
    email: String(email || "").trim(),
    phone: String(phone || "").trim(),
    role: "admin",
    password: String(password || ""),
  });

  return response.data || {};
};

/* =========================
   LOGOUT
========================= */

export const logoutUser = async () => {
  try {
    await AsyncStorage.multiRemove(["userToken", "userProfile"]);
  } finally {
    clearTokenCache();
  }
};

/* =========================
   CHECK LOGIN
========================= */

export const isLoggedIn = async () => {
  const token = await getStoredToken();
  return !!token;
};

export default api;
