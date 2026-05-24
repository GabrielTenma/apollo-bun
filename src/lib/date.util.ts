export const toISOString = (date: Date | string = new Date()): string => {
	if (typeof date === "string") return new Date(date).toISOString();
	return date.toISOString();
};

export const formatDate = (
	date: Date | string,
	locale = "en-US",
	options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "long",
		day: "numeric",
	},
): string => {
	const d = typeof date === "string" ? new Date(date) : date;
	return new Intl.DateTimeFormat(locale, options).format(d);
};

export const addTime = (
	date: Date,
	amount: number,
	unit: "days" | "hours" | "minutes" | "seconds",
): Date => {
	const result = new Date(date);
	switch (unit) {
		case "days":
			result.setDate(result.getDate() + amount);
			break;
		case "hours":
			result.setHours(result.getHours() + amount);
			break;
		case "minutes":
			result.setMinutes(result.getMinutes() + amount);
			break;
		case "seconds":
			result.setSeconds(result.getSeconds() + amount);
			break;
	}
	return result;
};

export const isExpired = (date: Date | string): boolean => {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.getTime() < Date.now();
};

export const dateDiff = (
	date1: Date | string,
	date2: Date | string = new Date(),
	unit: "days" | "hours" | "minutes" | "seconds" = "days",
): number => {
	const d1 = typeof date1 === "string" ? new Date(date1) : date1;
	const d2 = typeof date2 === "string" ? new Date(date2) : date2;
	const diffMs = Math.abs(d2.getTime() - d1.getTime());
	switch (unit) {
		case "seconds":
			return Math.floor(diffMs / 1000);
		case "minutes":
			return Math.floor(diffMs / (1000 * 60));
		case "hours":
			return Math.floor(diffMs / (1000 * 60 * 60));
		default:
			return Math.floor(diffMs / (1000 * 60 * 60 * 24));
	}
};
