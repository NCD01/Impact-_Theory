using ImpactTheory.Gameplay;
using ImpactTheory.Runtime.Gameplay;
using UnityEngine;

namespace ImpactTheory.Runtime.UI
{
    /// <summary>
    /// The heads-up display and the on-screen controls.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Built with IMGUI rather than a canvas prefab. That is a deliberate prototype choice with a
    /// concrete reason: no Unity editor is installed (<c>ISSUE-001</c>), so a canvas hierarchy
    /// would have to be hand-authored as scene YAML with generated GUIDs - brittle to write blind
    /// and unpleasant to review. IMGUI is code, so it is reviewable, diffable, and correct on first
    /// open. It scales with screen size, which the responsive requirement in
    /// <c>Docs/GameDesign.md</c> §6 needs, and it works in a Web build.
    /// </para>
    /// <para>
    /// It is not the shipping UI. Replacing it with UI Toolkit or uGUI is a presentation change
    /// that touches nothing else, because the HUD only reads state and raises the same input
    /// actions a key or a finger would.
    /// </para>
    /// <para>
    /// The on-screen Fire, power, and restart controls are what make touch a first-class input
    /// rather than a retrofit (Addendum 005 §8). They are the resolution of the gesture conflict
    /// described in <see cref="Runtime.Input.GameInput"/>: gestures aim and orbit, controls commit.
    /// </para>
    /// </remarks>
    [RequireComponent(typeof(GameDirector))]
    public sealed class HudController : MonoBehaviour
    {
        private const float ReferenceWidth = 1280f;

        private GameDirector _director;
        private GUIStyle _panel;
        private GUIStyle _label;
        private GUIStyle _title;
        private GUIStyle _button;
        private GUIStyle _brand;
        private Texture2D _panelTexture;
        private Texture2D _barBackground;
        private Texture2D _barFill;

        private void Awake() => _director = GetComponent<GameDirector>();

        private void OnDestroy()
        {
            Destroy(_panelTexture);
            Destroy(_barBackground);
            Destroy(_barFill);
        }

        private void OnGUI()
        {
            EnsureStyles();

            // One uniform scale from a reference width keeps the layout identical on a laptop and
            // a tablet without writing two layouts. Pixels are never a structural measurement
            // (Addendum 003 section 4) - they are only a presentation one, and this is the one
            // place they are allowed to matter.
            float scale = Mathf.Clamp(Screen.width / ReferenceWidth, 0.75f, 2.2f);
            Matrix4x4 previous = GUI.matrix;
            GUI.matrix = Matrix4x4.TRS(Vector3.zero, Quaternion.identity, Vector3.one * scale);

            float width = Screen.width / scale;
            float height = Screen.height / scale;

            DrawStatusPanel();
            DrawBrand(width);
            if (_director.Input.AdvancedPowerEnabled)
            {
                DrawPowerControl(width, height);
            }
            DrawActionButtons(width, height);
            DrawOutcome(width, height);
            DrawControlHints(width, height);

            GUI.matrix = previous;
        }

        private void DrawStatusPanel()
        {
            LevelStateMachine level = _director.Level;
            StructureBlueprint blueprint = _director.CurrentBlueprint;

            GUILayout.BeginArea(new Rect(16f, 16f, 320f, 176f), _panel);
            GUILayout.Space(10f);

            GUILayout.Label(
                blueprint != null ? blueprint.DisplayName : "Impact Theory", _title);

            GUILayout.Label(
                $"Level {_director.LevelIndex + 1} of {_director.LevelCount}", _label);

            GUILayout.Space(6f);

            GUILayout.Label(
                $"Balls   {level.Balls.Remaining} left  ({level.Balls.Used}/{level.Balls.Allowed} used)",
                _label);

            GUILayout.Label($"Pieces  {_director.RemainingPieces} still on the platform", _label);
            GUILayout.Label($"Aim     {_director.Aim.YawDegrees:0}°  /  {_director.Aim.PitchDegrees:0}°", _label);

            GUILayout.EndArea();
        }

        private void DrawBrand(float width)
        {
            GUI.Label(
                new Rect(width - 290f, 18f, 274f, 34f),
                "NCD // RETRO ARCADE",
                _brand);
        }

        private void DrawPowerControl(float width, float height)
        {
            float barWidth = 260f;
            float x = (width - barWidth) * 0.5f;
            float y = height - 92f;

            GUI.DrawTexture(new Rect(x, y, barWidth, 22f), _barBackground);
            GUI.DrawTexture(
                new Rect(x + 2f, y + 2f, (barWidth - 4f) * _director.Aim.Power, 18f), _barFill);

            GUI.Label(new Rect(x, y - 24f, barWidth, 22f),
                $"Power  {_director.Aim.Power * 100f:0}%", _label);

            // Touch-friendly power adjustment. Held rather than tapped, so a slow adjustment is one
            // gesture instead of twenty taps.
            if (GUI.RepeatButton(new Rect(x - 54f, y - 6f, 46f, 34f), "-", _button))
            {
                _director.Input.RequestPower(-0.6f * Time.deltaTime);
            }

            if (GUI.RepeatButton(new Rect(x + barWidth + 8f, y - 6f, 46f, 34f), "+", _button))
            {
                _director.Input.RequestPower(0.6f * Time.deltaTime);
            }
        }

        private void DrawActionButtons(float width, float height)
        {
            LevelPhase phase = _director.Level.Phase;
            bool canFire = phase == LevelPhase.Ready || phase == LevelPhase.Aiming;

            GUI.enabled = canFire;
            if (GUI.Button(new Rect(width - 196f, height - 92f, 172f, 56f), "FIRE", _button))
            {
                _director.Input.RequestFire();
            }

            GUI.enabled = true;

            if (GUI.Button(new Rect(24f, height - 92f, 150f, 56f), "RESTART", _button))
            {
                _director.Input.RequestRestart();
            }
        }

        private void DrawOutcome(float width, float height)
        {
            LevelStateMachine level = _director.Level;
            if (!level.IsOver)
            {
                return;
            }

            float boxWidth = 440f;
            float boxHeight = 210f;
            Rect box = new Rect(
                (width - boxWidth) * 0.5f, (height - boxHeight) * 0.5f, boxWidth, boxHeight);

            GUI.DrawTexture(box, _panelTexture);

            GUILayout.BeginArea(new Rect(box.x + 24f, box.y + 20f, box.width - 48f, box.height - 40f));

            bool won = level.Phase == LevelPhase.Won;
            GUILayout.Label(won ? "PLATFORM CLEARED" : "OUT OF BALLS", _title);
            GUILayout.Space(8f);

            if (won)
            {
                ScoreResult score = level.Score;
                GUILayout.Label($"Score  {score.Total}", _label);
                GUILayout.Label(
                    $"Used {score.BallsUsed} of {score.BallsAllowed} balls" +
                    (score.BallsUnused > 0 ? $"  (+{score.EfficiencyBonus} efficiency)" : string.Empty),
                    _label);

                if (score.OneShotBonus > 0)
                {
                    GUILayout.Label($"One-shot clear  +{score.OneShotBonus}", _label);
                }
            }
            else
            {
                GUILayout.Label(
                    $"{_director.RemainingPieces} piece(s) still on the platform.", _label);
                GUILayout.Label("Every required piece must leave the platform.", _label);
            }

            GUILayout.Space(14f);
            GUILayout.BeginHorizontal();

            if (GUILayout.Button("REPLAY", _button, GUILayout.Height(46f)))
            {
                _director.RestartLevel();
            }

            if (won && GUILayout.Button("NEXT", _button, GUILayout.Height(46f)))
            {
                _director.NextLevel();
            }

            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        private void DrawControlHints(float width, float height)
        {
            string hint = _director.Input.IsTouchActive
                ? "Drag to aim  ·  Two fingers to orbit  ·  Pinch to zoom"
                : "Drag or arrows to aim  ·  Space or FIRE to launch  ·  R to restart";

            GUI.Label(new Rect(16f, height - 30f, width - 32f, 24f), hint, _label);
        }

        private void EnsureStyles()
        {
            if (_panel != null)
            {
                return;
            }

            _panelTexture = SolidTexture(new Color(0.06f, 0.08f, 0.11f, 0.86f));
            _barBackground = SolidTexture(new Color(0.16f, 0.18f, 0.22f, 0.95f));
            _barFill = SolidTexture(new Color(1f, 0.68f, 0.22f, 0.98f));

            _panel = new GUIStyle(GUI.skin.box)
            {
                normal = { background = _panelTexture },
                padding = new RectOffset(14, 14, 10, 10),
            };

            _label = new GUIStyle(GUI.skin.label)
            {
                fontSize = 15,
                normal = { textColor = new Color(0.90f, 0.92f, 0.95f) },
                wordWrap = true,
            };

            _title = new GUIStyle(GUI.skin.label)
            {
                fontSize = 20,
                fontStyle = FontStyle.Bold,
                normal = { textColor = new Color(1f, 0.82f, 0.35f) },
            };

            _button = new GUIStyle(GUI.skin.button) { fontSize = 17, fontStyle = FontStyle.Bold };

            _brand = new GUIStyle(GUI.skin.label)
            {
                fontSize = 16,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.UpperRight,
                normal = { textColor = new Color(0.32f, 0.95f, 1f) },
            };
        }

        private static Texture2D SolidTexture(Color colour)
        {
            Texture2D texture = new Texture2D(1, 1);
            texture.SetPixel(0, 0, colour);
            texture.Apply();
            return texture;
        }
    }
}
