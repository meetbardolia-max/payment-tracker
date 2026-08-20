import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const client = axios.create({ baseURL: API, withCredentials: true });
export const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const money = (n) => inr.format(Number(n) || 0);
export const shortMoney = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return inr.format(v);
};
export const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("en-GB") : "—");
export const daysBetween = (iso) => {
  if (!iso) return 0;
  const d = new Date(iso);
  const t = new Date();
  return Math.floor((t - d) / (1000 * 60 * 60 * 24));
};
export const initials = (name) =>
  (name || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const OUTCOME_LABEL = {
  paid_full: "Paid in full",
  paid_partial: "Paid partial",
  not_paid: "Not paid",
};

export const ROLE_LABEL = {
  owner: "Owner",
  head_officer: "Head collection officer",
  field_officer: "Field collection officer",
};
