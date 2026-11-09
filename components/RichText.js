import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// The small slice of markdown Ask FLO's answers may use (44-ai-assistant.md,
// "Rich answers"): **bold**, "- " bullets, "1. " numbered lists and a short
// "#" heading. FLO's own, no library. Everything else is shown as plain
// words, never raw symbols: links keep their text, `code` loses its ticks,
// and a table the model wrote anyway becomes "a · b · c" lines (real tables
// are drawn from tool results by BreakdownTable).

// text → [{ kind: 'heading' | 'para' | 'bullet' | 'number', text, n? }]
export function parseRichText(text) {
  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'para', text: para.join('\n') });
    para = [];
  };
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    let m;
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush(); // a horizontal rule ("---", "- - -"): just a break
    } else if ((m = line.match(/^\s*#{1,6}\s+(.*)$/))) {
      flush();
      blocks.push({ kind: 'heading', text: m[1] });
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      flush();
      blocks.push({ kind: 'bullet', text: m[1] });
    } else if ((m = line.match(/^\s*(\d{1,2})[.)]\s+(.*)$/))) {
      // One or two digits only, so "2026. was a good year" stays a sentence.
      flush();
      blocks.push({ kind: 'number', n: m[1], text: m[2] });
    } else if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      // A table separator row (|---|:--:|) carries no words.
      if (/^[\s|:-]+$/.test(line)) continue;
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).filter(Boolean);
      blocks.push({ kind: 'para', text: cells.join(' · ') });
    } else {
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

// One line of text → [{ text, bold }], with links and code ticks cleaned
// away. Only **double asterisks** mean bold; underscores are left alone (they
// turn up in real names), and a lone "*" stays, since "2 * 3" means it.
export function parseInline(text) {
  const clean = String(text)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\\\*/g, '\u0000'); // an escaped \* is a real asterisk
  const parts = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(clean))) {
    if (m.index > last) parts.push({ text: clean.slice(last, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < clean.length) parts.push({ text: clean.slice(last), bold: false });
  // A "**" left unmatched (bold cut off mid-reveal, or never closed) is noise.
  return parts.map((p) => ({ ...p, text: p.text.replace(/\*\*/g, '').replace(/\u0000/g, '*') }));
}

export default function RichText({ text, style }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const blocks = useMemo(() => parseRichText(text), [text]);

  const inline = (t) =>
    parseInline(t).map((p, i) => (
      <Text key={i} style={p.bold ? styles.bold : null}>
        {p.text}
      </Text>
    ));

  return (
    <View style={[styles.wrap, style]}>
      {blocks.map((b, i) => {
        if (b.kind === 'heading') {
          return (
            <Text key={i} style={styles.heading} accessibilityRole="header">
              {inline(b.text)}
            </Text>
          );
        }
        if (b.kind === 'bullet' || b.kind === 'number') {
          return (
            <View key={i} style={styles.item}>
              <Text style={styles.marker}>{b.kind === 'bullet' ? '•' : `${b.n}.`}</Text>
              <Text style={styles.itemText}>{inline(b.text)}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={styles.body}>
            {inline(b.text)}
          </Text>
        );
      })}
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    body: bodyText(colors),
    bold: {
      fontFamily: fontFamily.bold,
      color: colors.ink,
    },
    heading: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.bodyLg,
      lineHeight: 22,
      color: colors.ink,
    },
    item: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingLeft: spacing.xs,
    },
    marker: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.body,
      lineHeight: 21,
      color: colors.muted,
      minWidth: 14,
    },
    itemText: {
      ...bodyText(colors),
      flex: 1,
    },
  });
}

function bodyText(colors) {
  return {
    fontFamily: fontFamily.semibold,
    fontSize: type.body,
    lineHeight: 21,
    color: colors.ink,
  };
}
