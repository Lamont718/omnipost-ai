export const ORG_COLORS: Record<string, { bg: string; text: string; dot: string; badge: string }> = {
  "#534AB7": { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", badge: "bg-purple-100 text-purple-700" },
  "#0D9488": { bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500", badge: "bg-teal-100 text-teal-700" },
  "#D97706": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
  "#EA580C": { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700" },
  "#DC2626": { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", badge: "bg-red-100 text-red-700" },
};

export function getOrgStyle(colorHex: string) {
  return ORG_COLORS[colorHex] || { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500", badge: "bg-gray-100 text-gray-700" };
}
