/**
 * Restaurant Identity Resolver
 *
 * Resolves a source record's restaurant identity to a MongoDB Restaurant document.
 *
 * Strategy (conservative — Milestone 5A):
 *  1. Match by name (case-insensitive, trimmed) AND city (case-insensitive, trimmed)
 *  2. If exactly 1 match → resolved
 *  3. If 0 matches → not found
 *  4. If >1 matches → ambiguous, reject (do not guess)
 *
 * This prevents attaching evidence to the wrong restaurant.
 * Future milestones may add address/pincode fuzzy matching, external IDs,
 * or a restaurant alias table — but for now, safe > clever.
 */

import restaurantModel from "../../models/restaurantModel.js";

/**
 * Resolve a restaurant from a normalized source record.
 * @param {Object} record — Normalized record with restaurantName, city, etc.
 * @returns {Promise<{ resolved: boolean, restaurant: Object|null, reason: string }>}
 */
const resolve = async (record) => {
    const name = record.restaurantName;
    const city = record.city;

    if (!name) {
        return { resolved: false, restaurant: null, reason: "No restaurant name provided" };
    }

    // Build query — case-insensitive on name and city
    const query = {
        name: { $regex: `^${escapeRegex(name.trim())}$`, $options: "i" }
    };

    if (city) {
        query.city = { $regex: `^${escapeRegex(city.trim())}$`, $options: "i" };
    }

    const matches = await restaurantModel.find(query).lean();

    if (matches.length === 0) {
        return {
            resolved: false,
            restaurant: null,
            reason: `No restaurant found matching name "${name}"${city ? ` in city "${city}"` : ""}`
        };
    }

    if (matches.length > 1) {
        const names = matches.map(m => `${m.name} (${m.city})`).join(", ");
        return {
            resolved: false,
            restaurant: null,
            reason: `Ambiguous match: ${matches.length} restaurants found (${names}). Cannot safely attach evidence.`
        };
    }

    return {
        resolved: true,
        restaurant: matches[0],
        reason: `Matched: ${matches[0].name} in ${matches[0].city}`
    };
};

/**
 * Escape special regex characters in a string.
 */
const escapeRegex = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export { resolve };
