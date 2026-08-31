using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace ImpactTheory.Save
{
    /// <summary>Raised when a save payload cannot be read.</summary>
    public sealed class SaveFormatException : Exception
    {
        public SaveFormatException(string message)
            : base(message)
        {
        }
    }

    /// <summary>
    /// Reads and writes <see cref="SaveData"/> as JSON.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Hand-written rather than delegating to a library, for two reasons that both matter here.
    /// <c>System.Text.Json</c> is not available in Unity's scripting profile, and Unity's own
    /// <c>JsonUtility</c> cannot serialise a dictionary and does not run outside the engine - which
    /// would put the save format beyond the reach of the test suite. This keeps
    /// <c>ImpactTheory.Save</c> engine-free and therefore testable, which is the whole arrangement
    /// the project depends on.
    /// </para>
    /// <para>
    /// The parser is deliberately small and strict. It handles exactly the JSON this schema
    /// produces, and rejects anything else with a clear error rather than guessing - a save file is
    /// player data, and quietly misreading it is worse than refusing it
    /// (<c>Docs/GameDesign.md</c> §48).
    /// </para>
    /// <para>
    /// Numbers are written with <see cref="CultureInfo.InvariantCulture"/> throughout. Without
    /// that, a machine with a comma decimal separator writes <c>0,8</c> and produces a file that
    /// every other machine rejects.
    /// </para>
    /// </remarks>
    public static class SaveSerializer
    {
        public static string Serialize(SaveData data)
        {
            StringBuilder json = new StringBuilder(512);

            json.Append('{');
            WriteNumber(json, "schemaVersion", data.SchemaVersion);
            json.Append(',');
            WriteString(json, "gameVersion", data.GameVersion ?? "0.0");
            json.Append(',');
            WriteBool(json, "tutorialSeen", data.TutorialSeen);
            json.Append(',');
            WriteFloat(json, "volume", data.Volume);
            json.Append(",\"levels\":[");

            bool first = true;
            foreach (LevelProgress level in data.Levels.Values)
            {
                if (!first)
                {
                    json.Append(',');
                }

                first = false;

                json.Append('{');
                WriteString(json, "levelId", level.LevelId);
                json.Append(',');
                WriteBool(json, "completed", level.Completed);
                json.Append(',');
                WriteNumber(json, "bestScore", level.BestScore);
                json.Append(',');
                WriteNumber(json, "bestBallCount", level.BestBallCount);
                json.Append(',');
                WriteNumber(json, "timesPlayed", level.TimesPlayed);
                json.Append('}');
            }

            json.Append("]}");
            return json.ToString();
        }

        public static SaveData Deserialize(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                throw new SaveFormatException("save payload is empty");
            }

            Cursor cursor = new Cursor(json);
            object root = ParseValue(cursor);

            if (!(root is Dictionary<string, object> map))
            {
                throw new SaveFormatException("save payload is not a JSON object");
            }

            SaveData data = new SaveData
            {
                SchemaVersion = (int)ReadNumber(map, "schemaVersion", 0),
                GameVersion = ReadString(map, "gameVersion", "0.0"),
                TutorialSeen = ReadBool(map, "tutorialSeen", false),
                Volume = ReadNumber(map, "volume", 0.8f),
            };

            if (map.TryGetValue("levels", out object levelsValue) &&
                levelsValue is List<object> levels)
            {
                foreach (object entry in levels)
                {
                    if (!(entry is Dictionary<string, object> levelMap))
                    {
                        continue;
                    }

                    string id = ReadString(levelMap, "levelId", null);
                    if (string.IsNullOrEmpty(id))
                    {
                        continue;
                    }

                    data.Put(new LevelProgress(id)
                    {
                        Completed = ReadBool(levelMap, "completed", false),
                        BestScore = (int)ReadNumber(levelMap, "bestScore", 0),
                        BestBallCount = (int)ReadNumber(levelMap, "bestBallCount", 0),
                        TimesPlayed = (int)ReadNumber(levelMap, "timesPlayed", 0),
                    });
                }
            }

            return data;
        }

        // ------------------------------------------------------------------ writing

        private static void WriteString(StringBuilder json, string key, string value)
        {
            json.Append('"').Append(key).Append("\":");
            AppendEscaped(json, value);
        }

        private static void WriteNumber(StringBuilder json, string key, int value) =>
            json.Append('"').Append(key).Append("\":")
                .Append(value.ToString(CultureInfo.InvariantCulture));

        private static void WriteFloat(StringBuilder json, string key, float value) =>
            json.Append('"').Append(key).Append("\":")
                .Append(value.ToString("0.####", CultureInfo.InvariantCulture));

        private static void WriteBool(StringBuilder json, string key, bool value) =>
            json.Append('"').Append(key).Append("\":").Append(value ? "true" : "false");

        private static void AppendEscaped(StringBuilder json, string value)
        {
            json.Append('"');

            foreach (char c in value ?? string.Empty)
            {
                switch (c)
                {
                    case '"': json.Append("\\\""); break;
                    case '\\': json.Append("\\\\"); break;
                    case '\n': json.Append("\\n"); break;
                    case '\r': json.Append("\\r"); break;
                    case '\t': json.Append("\\t"); break;
                    default:
                        if (c < ' ')
                        {
                            json.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            json.Append(c);
                        }

                        break;
                }
            }

            json.Append('"');
        }

        // ------------------------------------------------------------------ reading

        private sealed class Cursor
        {
            public readonly string Text;
            public int Index;

            public Cursor(string text)
            {
                Text = text;
            }
        }

        private static object ParseValue(Cursor cursor)
        {
            SkipWhitespace(cursor);

            if (cursor.Index >= cursor.Text.Length)
            {
                throw new SaveFormatException("unexpected end of save payload");
            }

            char c = cursor.Text[cursor.Index];

            switch (c)
            {
                case '{': return ParseObject(cursor);
                case '[': return ParseArray(cursor);
                case '"': return ParseString(cursor);
                case 't': Expect(cursor, "true"); return true;
                case 'f': Expect(cursor, "false"); return false;
                case 'n': Expect(cursor, "null"); return null;
                default: return ParseNumber(cursor);
            }
        }

        private static Dictionary<string, object> ParseObject(Cursor cursor)
        {
            Dictionary<string, object> map = new Dictionary<string, object>();
            cursor.Index++;
            SkipWhitespace(cursor);

            if (Peek(cursor) == '}')
            {
                cursor.Index++;
                return map;
            }

            while (true)
            {
                SkipWhitespace(cursor);

                if (Peek(cursor) != '"')
                {
                    throw new SaveFormatException($"expected a key at position {cursor.Index}");
                }

                string key = ParseString(cursor);
                SkipWhitespace(cursor);

                if (Peek(cursor) != ':')
                {
                    throw new SaveFormatException($"expected ':' after key '{key}'");
                }

                cursor.Index++;
                map[key] = ParseValue(cursor);
                SkipWhitespace(cursor);

                char next = Peek(cursor);
                cursor.Index++;

                if (next == '}')
                {
                    return map;
                }

                if (next != ',')
                {
                    throw new SaveFormatException($"expected ',' or '}}' at position {cursor.Index}");
                }
            }
        }

        private static List<object> ParseArray(Cursor cursor)
        {
            List<object> items = new List<object>();
            cursor.Index++;
            SkipWhitespace(cursor);

            if (Peek(cursor) == ']')
            {
                cursor.Index++;
                return items;
            }

            while (true)
            {
                items.Add(ParseValue(cursor));
                SkipWhitespace(cursor);

                char next = Peek(cursor);
                cursor.Index++;

                if (next == ']')
                {
                    return items;
                }

                if (next != ',')
                {
                    throw new SaveFormatException($"expected ',' or ']' at position {cursor.Index}");
                }
            }
        }

        private static string ParseString(Cursor cursor)
        {
            cursor.Index++;
            StringBuilder value = new StringBuilder();

            while (cursor.Index < cursor.Text.Length)
            {
                char c = cursor.Text[cursor.Index++];

                if (c == '"')
                {
                    return value.ToString();
                }

                if (c != '\\')
                {
                    value.Append(c);
                    continue;
                }

                if (cursor.Index >= cursor.Text.Length)
                {
                    break;
                }

                char escape = cursor.Text[cursor.Index++];
                switch (escape)
                {
                    case '"': value.Append('"'); break;
                    case '\\': value.Append('\\'); break;
                    case '/': value.Append('/'); break;
                    case 'b': value.Append('\b'); break;
                    case 'f': value.Append('\f'); break;
                    case 'n': value.Append('\n'); break;
                    case 'r': value.Append('\r'); break;
                    case 't': value.Append('\t'); break;
                    case 'u':
                        if (cursor.Index + 4 > cursor.Text.Length)
                        {
                            throw new SaveFormatException("truncated unicode escape");
                        }

                        value.Append((char)int.Parse(
                            cursor.Text.Substring(cursor.Index, 4),
                            NumberStyles.HexNumber,
                            CultureInfo.InvariantCulture));

                        cursor.Index += 4;
                        break;

                    default:
                        throw new SaveFormatException($"unknown escape '\\{escape}'");
                }
            }

            throw new SaveFormatException("unterminated string in save payload");
        }

        private static float ParseNumber(Cursor cursor)
        {
            int start = cursor.Index;

            while (cursor.Index < cursor.Text.Length)
            {
                char c = cursor.Text[cursor.Index];
                if (char.IsDigit(c) || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E')
                {
                    cursor.Index++;
                    continue;
                }

                break;
            }

            string slice = cursor.Text.Substring(start, cursor.Index - start);

            if (!float.TryParse(
                    slice, NumberStyles.Float, CultureInfo.InvariantCulture, out float value))
            {
                throw new SaveFormatException($"'{slice}' is not a number");
            }

            return value;
        }

        private static void Expect(Cursor cursor, string literal)
        {
            if (cursor.Index + literal.Length > cursor.Text.Length ||
                string.CompareOrdinal(cursor.Text, cursor.Index, literal, 0, literal.Length) != 0)
            {
                throw new SaveFormatException($"expected '{literal}' at position {cursor.Index}");
            }

            cursor.Index += literal.Length;
        }

        private static char Peek(Cursor cursor) =>
            cursor.Index < cursor.Text.Length ? cursor.Text[cursor.Index] : '\0';

        private static void SkipWhitespace(Cursor cursor)
        {
            while (cursor.Index < cursor.Text.Length && char.IsWhiteSpace(cursor.Text[cursor.Index]))
            {
                cursor.Index++;
            }
        }

        private static float ReadNumber(
            IReadOnlyDictionary<string, object> map, string key, float fallback) =>
            map.TryGetValue(key, out object value) && value is float number ? number : fallback;

        private static string ReadString(
            IReadOnlyDictionary<string, object> map, string key, string fallback) =>
            map.TryGetValue(key, out object value) && value is string text ? text : fallback;

        private static bool ReadBool(
            IReadOnlyDictionary<string, object> map, string key, bool fallback) =>
            map.TryGetValue(key, out object value) && value is bool flag ? flag : fallback;
    }
}
