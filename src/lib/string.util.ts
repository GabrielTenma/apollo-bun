export const capitalize = (str: string): string => {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1);
};

export const toCamelCase = (str: string): string => {
	return str
		.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
		.replace(/^[A-Z]/, (char) => char.toLowerCase());
};

export const toPascalCase = (str: string): string => {
	const camelCase = toCamelCase(str);
	return capitalize(camelCase);
};

export const toKebabCase = (str: string): string => {
	return str
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
};

export const toSnakeCase = (str: string): string => {
	return str
		.replace(/([a-z])([A-Z])/g, "$1_$2")
		.replace(/[\s-]+/g, "_")
		.toLowerCase();
};

export const randomString = (
	length = 8,
	chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
): string => {
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
};

export const slugify = (str: string): string => {
	return str
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
};

export const truncate = (
	str: string,
	maxLength = 50,
	suffix = "...",
): string => {
	if (str.length <= maxLength) return str;
	return str.slice(0, maxLength - suffix.length) + suffix;
};
