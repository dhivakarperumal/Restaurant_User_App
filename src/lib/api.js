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
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem("userToken", token);
      } catch {}
    }
  } else {
    await AsyncStorage.removeItem("userToken");
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem("userToken");
      } catch {}
    }
  }
};

export const getStoredToken = async () => {
  if (cachedToken) {
    return cachedToken;
  }

  let token = null;
  try {
    token = await AsyncStorage.getItem("userToken");
  } catch (error) {
    console.warn("AsyncStorage.getItem(userToken) error:", error);
  }

  if (!token && typeof window !== "undefined" && window.localStorage) {
    try {
      token = window.localStorage.getItem("userToken");
    } catch {}
  }

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
    const serialized = JSON.stringify(user);
    await AsyncStorage.setItem("userProfile", serialized);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem("userProfile", serialized);
      } catch {}
    }
  }
};

export const getStoredRole = async () => {
  let role = null;
  try {
    role = await AsyncStorage.getItem("userRole");
  } catch {}

  if (!role && typeof window !== "undefined" && window.localStorage) {
    try {
      role = window.localStorage.getItem("userRole");
    } catch {}
  }

  if (role) {
    return role;
  }

  const user = await getStoredUser();
  return user?.role || null;
};

export const getStoredUser = async () => {
  let user = null;
  try {
    user = await AsyncStorage.getItem("userProfile");
  } catch {}

  if (!user && typeof window !== "undefined" && window.localStorage) {
    try {
      user = window.localStorage.getItem("userProfile");
    } catch {}
  }

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

    const responseBody = response.data || {};
    const data =
      responseBody.data && typeof responseBody.data === "object"
        ? responseBody.data
        : responseBody;
    const role =
      data.user?.role ??
      data.role ??
      responseBody.user?.role ??
      responseBody.role;

    const token =
      data.token ??
      data.accessToken ??
      data.access_token ??
      responseBody.token ??
      responseBody.accessToken ??
      responseBody.access_token;

    if (typeof token === "string" && token.trim()) {
      await setAuthToken(token.trim());
    }

    if (role) {
      await AsyncStorage.setItem("userRole", String(role));
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem("userRole", String(role));
        } catch {}
      }
    }

    const userObj =
      (data.user && typeof data.user === "object" ? data.user : null) ??
      (responseBody.user && typeof responseBody.user === "object"
        ? responseBody.user
        : null) ??
      (data && typeof data === "object" ? data : null);

    if (userObj || role) {
      await saveUser({
        ...(userObj && typeof userObj === "object" ? userObj : {}),
        ...(role ? { role } : {}),
      });
    }

    return {
      ...data,
      token,
      role,
      message: data.message || responseBody.message || "Login successful",
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
    await AsyncStorage.multiRemove(["userToken", "userProfile", "userRole"]);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem("userToken");
        window.localStorage.removeItem("userProfile");
        window.localStorage.removeItem("userRole");
      } catch {}
    }
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
