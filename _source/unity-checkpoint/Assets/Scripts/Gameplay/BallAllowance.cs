namespace ImpactTheory.Gameplay
{
    /// <summary>
    /// Tracks how many balls a level grants and how many have been fired.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <c>Docs/GameDesign.md</c> §23: each level provides a maximum number of balls, and the player
    /// fires until the structure is cleared or the allowance is exhausted.
    /// </para>
    /// <para>
    /// The subtle part is <em>when</em> failure is decided. The specification says the level fails
    /// "if the structure remains after the final allowed shot <strong>resolves</strong>" - not at
    /// the moment the last ball is fired. That distinction is the whole drama of the last shot:
    /// the ball is in the air, the tower is leaning, and the level is not lost until it stops
    /// moving. <see cref="LevelStateMachine"/> owns that timing; this type only counts.
    /// </para>
    /// </remarks>
    public sealed class BallAllowance
    {
        public BallAllowance(int allowed)
        {
            Allowed = allowed < 0 ? 0 : allowed;
        }

        public int Allowed { get; private set; }

        public int Used { get; private set; }

        public int Remaining => Allowed - Used > 0 ? Allowed - Used : 0;

        /// <summary>True while at least one ball is left.</summary>
        public bool CanFire => Remaining > 0;

        /// <summary>True once every ball has been fired, regardless of whether they have resolved.</summary>
        public bool IsExhausted => Remaining == 0;

        /// <summary>
        /// Records a shot. Returns false when there was nothing left to fire.
        /// </summary>
        /// <remarks>
        /// Returning false rather than throwing: an extra fire request is a normal race between
        /// input and state, not a programming error. The caller ignores it and the count stays
        /// honest.
        /// </remarks>
        public bool RecordShot()
        {
            if (!CanFire)
            {
                return false;
            }

            Used++;
            return true;
        }

        /// <summary>Sets a new allowance and clears the count.</summary>
        public void Reset(int allowed)
        {
            Allowed = allowed < 0 ? 0 : allowed;
            Used = 0;
        }

        /// <summary>Clears the count, keeping the current allowance.</summary>
        public void Reset() => Used = 0;

        public override string ToString() => $"balls {Used}/{Allowed} used, {Remaining} remaining";
    }
}
