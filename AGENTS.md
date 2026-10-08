<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep companion purchase rules and derived stats in a pure browser-safe module shared by the game and tests, so shop gating and gameplay stay consistent.
- Companion ownership is run-scoped, and its autonomous deliveries use the same production counters as the player so reports include the whole team's work.
- Keep factory station layout in a pure shared module so every level uses the same ordered delivery area and tests guard it.
