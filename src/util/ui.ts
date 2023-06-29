import { micromark } from "micromark";
import { gfmAutolinkLiteral, gfmAutolinkLiteralHtml } from "micromark-extension-gfm-autolink-literal";
import { Event } from "../nostr-tools/event";
import { NestedNote } from "./nest";
import { usersStore } from "./stores";
import { AddressPointer, decode, naddrEncode, noteEncode, npubEncode } from "../nostr-tools/nip19";
import { Filter } from "../nostr-tools/filter";
import { replaceAll } from "../nostr-tools/nip27";

// Misc profile helpers

export const updateMetadata = (result: Event<0>[]): void => {
  // For each metadata event, check if it was created later
  // and merge interesting properties into usersStore entry
  result.forEach(e => {
    const payload = JSON.parse(e.content);
    if (usersStore[e.pubkey].timestamp < e.created_at!) {
      usersStore[e.pubkey] = {
        ...usersStore[e.pubkey],
        timestamp: e.created_at!,
        imgUrl: payload.image || payload.picture,
        name: payload.displayName || payload.display_name || payload.name,
      };
    }
  });
};

export const filterToReplaceableId = (id: string): string => {
  const decoded = decode(id);
  const data = decoded.data as AddressPointer;
  return `${data.kind}:${data.pubkey}:${data.identifier}`;
};

export const tagFor = (filter: Filter): string[] => {
  if (filter["#e"]) {
    return ["e", filter["#e"][0], "", "root"];
  } else {
    return ["a", filter["#a"][0], "", "root"];
  }
};

export const parseContent = (e: Event): string => {

  let content = e.content;

  // NIP-08 => NIP-27 + Markdown
  content = content.replace(/\#\[([0-9])\]/g, (match, capture) => {
    switch (e.tags[capture][0]) {
      case "e":
        return 'nostr:' + noteEncode(e.tags[capture][1]);
      case "a":
        const [kind, pubkey, identifier] = e.tags[capture][1].split(":");
        return 'nostr:' + naddrEncode({ identifier, pubkey, kind: parseInt(kind) });
      case "p":
        const _pubkey = e.tags[capture][1];
        const npub = npubEncode(_pubkey);
        const text = usersStore[_pubkey]?.name || shortenEncodedId(npub);
        return `[@${text}](https://nostr.com/${npub})`;
      default:
        return match;
    }
  });

  // NIP-27 => Markdown
  content = replaceAll(content, ({ decoded, value }) => {
    return `[@${shortenEncodedId(value)}](https://nostr.com/${value})`;
  });

  // Markdown => HTML
  return micromark(content, {
    extensions: [gfmAutolinkLiteral],
    htmlExtensions: [gfmAutolinkLiteralHtml]
  });
};

export const shortenEncodedId = (encoded: string) => {
  return encoded.substring(0, 8) + '...' + encoded.substring(encoded.length - 4);
};

export const svgWidth = 20;
export const randomCount = () => Math.floor(Math.random() * 42);

export const defaultPicture = 'data:image/svg+xml;utf-8,<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="512" r="512" fill="%23333" fill-rule="evenodd" /></svg>';

export const timeAgo = (timestamp: number): string => {
  const now = new Date();
  const secondsPast = Math.floor((now.getTime() - timestamp) / 1000);

  if (secondsPast < 60) {
    return 'now';
  }
  if (secondsPast < 3600) {
    const m = Math.floor(secondsPast / 60);
    return `${m} minute${m === 1 ? '' : 's'} ago`;
  }
  if (secondsPast <= 86400) {
    const h = Math.floor(secondsPast / 3600);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (secondsPast > 86400) {
    const date: Date = new Date(timestamp);
    const day = date.toLocaleDateString('en-us', { day: "numeric", month: "long" });
    const year = date.getFullYear() === now.getFullYear() ? '' : ' ' + date.getFullYear();
    return day + year;
  }
  return '';
};

// extensions

export const totalChildren = (event: NestedNote): number => {
  return event.children.reduce<number>((acc, c) => {
    return acc + totalChildren(c);
  }, event.children.length);
};