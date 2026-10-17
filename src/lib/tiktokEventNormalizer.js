/**
 * tiktokEventNormalizer.js
 * Pure functions that normalize raw tiktok-live-connector payloads
 * into a consistent shape for downstream consumers (games, bridge, debug).
 *
 * @module lib/tiktokEventNormalizer
 */

/**
 * Extract consistent user object from raw TikTok data.
 * @param {Object} raw - Raw event data from tiktok-live-connector
 * @returns {{uniqueId: string, nickname: string, profilePictureUrl: string}}
 */
export function normalizeUser(raw) {
  const usuario = raw.user ?? raw;
  const picture=value=>{
    if(typeof value==='string')return /^https?:\/\//i.test(value.trim())?value.trim():'';
    if(Array.isArray(value))return value.map(picture).find(Boolean)||'';
    if(value&&typeof value==='object')return picture(value.urlList??value.url_list??value.urls??value.url);
    return '';
  };
  const profilePictureUrl=[
    usuario.profilePictureUrl,raw.profilePictureUrl,
    usuario.avatarThumb,usuario.avatarMedium,usuario.avatarLarge,
    usuario.avatar_thumb,usuario.avatar_medium,usuario.avatar_large,
    raw.avatarThumb,raw.avatarMedium,raw.avatarLarge,
    raw.avatar_thumb,raw.avatar_medium,raw.avatar_large,
    usuario.userDetails?.profilePictureUrls,raw.userDetails?.profilePictureUrls
  ].map(picture).find(Boolean)||'';

  return {
    uniqueId:
      usuario.uniqueId ||
      raw.uniqueId ||
      usuario.displayId ||
      raw.displayId ||
      String(usuario.userId || usuario.idStr || usuario.id || raw.userId || "") ||
      "",

    nickname:
      usuario.nickname ||
      raw.nickname ||
      usuario.uniqueId ||
      "Anonymous",

    profilePictureUrl
  };
}
/**
 * Normalize chat event.
 * @param {Object} raw - Raw chat event
 * @returns {{user: Object, comment: string, timestamp: number}}
 */

export function normalizeChat(raw) {
  const comentario =
    raw.comment ??
    raw.commentText ??
    raw.content ??
    raw.text ??
    raw.message ??
    raw.data?.comment ??
    raw.data?.content ??
    "";

  return {
    user: normalizeUser(raw),
    comment: String(comentario).trim(),
    eventId: raw.eventId != null ? String(raw.eventId) : raw.msgId != null ? String(raw.msgId) : raw.common?.msgId != null ? String(raw.common.msgId) : null,
    timestamp: Date.now()
  };
}


/**
 * Normalize like event.
 * @param {Object} raw - Raw like event
 * @returns {{user: Object, likeCount: number, totalLikeCount: number, timestamp: number}}
 */
export function normalizeLike(raw) {
	const likeCount = raw.likeCount || raw.like_count || raw.count || 1;
	return {
		user: normalizeUser(raw),
		likeCount: Number(likeCount) || 1,
		eventId: raw.eventId != null ? String(raw.eventId) : raw.msgId != null ? String(raw.msgId) : raw.common?.msgId != null ? String(raw.common.msgId) : null,
		totalLikeCount: Number(raw.totalLikeCount || raw.total_like_count || 0),
		timestamp: Date.now(),
	};
}


/**
 * Normalize share event.
 * @param {Object} raw - Raw social event (filtered for shares only)
 * @returns {{user: Object, timestamp: number}}
 */
export function normalizeShare(raw) {
	return {
		user: normalizeUser(raw),
		timestamp: Date.now(),
	};
}

/**
 * Categorize gift by diamond value.
 * @param {number} value - Diamond count
 * @returns {"small"|"medium"|"large"}
 */
export function categorizeGift(value) {
	if (value >= 100) return "large";
	if (value >= 10) return "medium";
	return "small";
}

/**
 * Normalize gift event — the canonical shape for all consumers.
 * Adds giftId which was previously missing.
 *
 * @param {Object} raw - Raw gift event from tiktok-live-connector
 * @returns {{user: Object, giftId: number, giftName: string, giftValue: number, repeatCount: number, giftType: string, timestamp: number}}
 */
export function normalizeGift(raw) {
	const giftValue = raw.diamondCount || raw.giftValue || 1;
	return {
		user: normalizeUser(raw),
		giftId: raw.giftId || 0,
		giftName: raw.giftName || raw.giftDetails?.giftName || "Unknown Gift",
		giftValue,
		repeatCount: raw.repeatCount || 1,
		giftType: categorizeGift(giftValue),
		timestamp: Date.now(),
	};
}
