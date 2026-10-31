import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://restaurant.qtechx.com/api";
  

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

const ACTIVE_ROLE_KEY = "activeAuthRole";
const SESSION_KEYS = {
  user: {
    token: "userToken",
    role: "userRole",
    profile: "userProfile",
  },
  delivery_partner: {
    token: "deliveryPartnerToken",
    role: "deliveryPartnerRole",
    profile: "deliveryPartnerProfile",
  },
};

let cachedToken = null;
let cachedRole = null;
let authExpiredHandler = null;

const normalizeRole = (role) => {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "user") return "user";
  if (
    normalized === "delivery_partner" ||
    normalized === "deliverypartner" ||
    normalized === "delivery"
  ) {
    return "delivery_partner";
  }
  return null;
};

const readStoredValue = async (key) => {
  let value = await AsyncStorage.getItem(key);
  if (!value && typeof window !== "undefined" && window.localStorage) {
    try {
      value = window.localStorage.getItem(key);
    } catch {}
  }
  return value || null;
};

const writeStoredValue = async (key, value) => {
  await AsyncStorage.setItem(key, value);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }
};

const removeStoredValues = async (keys) => {
  await AsyncStorage.multiRemove(keys);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      for (const key of keys) window.localStorage.removeItem(key);
    } catch {}
  }
};

const parseStoredProfile = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/* =========================
   TOKEN MANAGEMENT
========================= */

export const saveAuthSession = async (role, token, profile) => {
  const normalizedRole = normalizeRole(role);
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedRole || !normalizedToken) {
    throw new Error("A valid account role and authentication token are required.");
  }

  const keys = SESSION_KEYS[normalizedRole];
  await writeStoredValue(keys.token, normalizedToken);
  await writeStoredValue(keys.role, normalizedRole);
  if (profile && typeof profile === "object") {
    await writeStoredValue(keys.profile, JSON.stringify({ ...profile, role: normalizedRole }));
  }
  await writeStoredValue(ACTIVE_ROLE_KEY, normalizedRole);

  cachedRole = normalizedRole;
  cachedToken = normalizedToken;
  return { role: normalizedRole, token: normalizedToken };
};

export const getStoredAuthSession = async () => {
  let activeRoleValue = await readStoredValue(ACTIVE_ROLE_KEY);
  let role = normalizeRole(activeRoleValue);

  if (activeRoleValue === "none") {
    cachedRole = null;
    cachedToken = null;
    return null;
  }

  if (!role && !activeRoleValue) {
    const legacyProfileValue = await readStoredValue("userProfile");
    const legacyProfile = parseStoredProfile(legacyProfileValue);
    const legacyRole = normalizeRole(
      (await readStoredValue("userRole")) ?? legacyProfile?.role,
    );
    const legacyToken = await readStoredValue("userToken");

    if (legacyRole && legacyToken) {
      const keys = SESSION_KEYS[legacyRole];
      await writeStoredValue(keys.token, legacyToken);
      await writeStoredValue(keys.role, legacyRole);
      if (legacyProfile) {
        await writeStoredValue(
          keys.profile,
          JSON.stringify({ ...legacyProfile, role: legacyRole }),
        );
      }
      await writeStoredValue(ACTIVE_ROLE_KEY, legacyRole);
      if (legacyRole === "delivery_partner") {
        await removeStoredValues(["userToken", "userRole", "userProfile"]);
      }
      role = legacyRole;
    }
  }

  if (!role) {
    cachedRole = null;
    cachedToken = null;
    return null;
  }

  const keys = SESSION_KEYS[role];
  const [token, storedRole, profileValue] = await Promise.all([
    readStoredValue(keys.token),
    readStoredValue(keys.role),
    readStoredValue(keys.profile),
  ]);
  if (!token || (storedRole && normalizeRole(storedRole) !== role)) {
    cachedRole = null;
    cachedToken = null;
    return null;
  }

  cachedRole = role;
  cachedToken = token;
  return { role, token, profile: parseStoredProfile(profileValue) };
};

export const getStoredToken = async () => {
  const session = await getStoredAuthSession();
  return session?.token ?? null;
};

export const clearTokenCache = () => {
  cachedToken = null;
  cachedRole = null;
};

export const setAuthToken = async (token, role) => {
  const activeRole = normalizeRole(
    role ?? cachedRole ?? (await readStoredValue(ACTIVE_ROLE_KEY)),
  );
  if (!token) {
    if (activeRole) await clearAuthSession(activeRole);
    return;
  }
  await saveAuthSession(activeRole ?? "user", token);
};

export const clearAuthSession = async (role, expectedToken) => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return;

  const keys = SESSION_KEYS[normalizedRole];
  if (
    expectedToken &&
    (await readStoredValue(keys.token)) !== expectedToken
  ) {
    return;
  }
  await removeStoredValues([keys.token, keys.role, keys.profile]);
  const activeRole = normalizeRole(await readStoredValue(ACTIVE_ROLE_KEY));
  if (activeRole === normalizedRole) {
    await writeStoredValue(ACTIVE_ROLE_KEY, "none");
    clearTokenCache();
  }
};

export const setAuthExpiredHandler = (handler) => {
  authExpiredHandler = handler;
  return () => {
    if (authExpiredHandler === handler) authExpiredHandler = null;
  };
};

/* =========================
   USER PROFILE
========================= */

export const saveUser = async (user) => {
  if (user) {
    const session = await getStoredAuthSession();
    const keys = SESSION_KEYS[session?.role ?? "user"];
    await writeStoredValue(keys.profile, JSON.stringify(user));
  }
};

export const getStoredRole = async () => {
  const session = await getStoredAuthSession();
  return session?.role ?? null;
};

export const getStoredUser = async () => {
  const session = await getStoredAuthSession();
  return session?.profile ?? null;
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
    const session = config.skipAuth ? null : await getStoredAuthSession();
    const token = session?.token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (session?.role && token) {
      config._authRole = session.role;
      config._authToken = token;
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
      if (
        (status === 401 || status === 403) &&
        error.config?._authRole &&
        authExpiredHandler
      ) {
        void authExpiredHandler(error.config._authRole, error.config._authToken);
      }

      return Promise.reject({
        status,
        message:
          error.response.data?.message ||
          error.response.data?.error ||
          "Server error",
        data: error.response.data,
        config: error.config,
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
    }, { skipAuth: true });

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

    const userObj =
      (data.user && typeof data.user === "object" ? data.user : null) ??
      (responseBody.user && typeof responseBody.user === "object"
        ? responseBody.user
        : null) ??
      (data && typeof data === "object" ? data : null);

    return {
      ...data,
      user: userObj,
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
  const response = await api.post("/users/register", {
    username: String(username || "").trim(),
    firstName: String(username || "").trim(),
    email: String(email || "").trim(),
    phone: String(phone || "").trim(),
    mobile_number: String(phone || "").trim(),
    role: "user",
    password: String(password || ""),
  }, { skipAuth: true });

  const responseBody = response.data || {};
  const data =
    responseBody.data && typeof responseBody.data === "object"
      ? responseBody.data
      : responseBody;
  const user =
    (data.user && typeof data.user === "object" ? data.user : null) ||
    (responseBody.user && typeof responseBody.user === "object"
      ? responseBody.user
      : null);
  const token =
    data.token ??
    data.accessToken ??
    data.access_token ??
    responseBody.token ??
    responseBody.accessToken ??
    responseBody.access_token;
  const role = user?.role ?? data.role ?? responseBody.role ?? "user";

  return { ...data, user, token, role };
};

/* =========================
   LOGOUT
========================= */

export const logoutUser = async () => {
  const session = await getStoredAuthSession();
  if (session) await clearAuthSession(session.role);
};

/* =========================
   CHECK LOGIN
========================= */

export const isLoggedIn = async () => {
  const token = await getStoredToken();
  return !!token;
};

export default api;
