# Judge walkthrough

Application: https://commonground-qloo-chen1220502052.zephyer-1990.chatgpt.site
Source: https://github.com/chen1220502052/commonground-qloo

No account, purchase or local installation is required for the public deployment.

1. Leave the four example people and their tastes selected. In **Live Qloo** mode, choose **Find real venues**. A cold request can take 20–60 seconds. On a rate-limit error, wait and retry; previous state is preserved.
2. Inspect **Everyone considered**. Each person has an individual relative rank. Expand **Inspect individual evidence** for raw Qloo affinity and available contributions.
3. Read the average-only comparison beneath the cards. It reports a tradeoff only when the actual winners differ.
4. In the command box, enter `Alex: no bars; Sam: closer`. Select **Preview changes**. Only the named changes are proposed. Apply them to trigger live replanning; inspect history and exclusions.
5. Use **Undo last feedback**. The previous shared radius and exclusions should return only after a successful query.
6. Use the explicit feedback form to reject one of the displayed venues. It must disappear from all recommended strategies, even if it has high affinity.
7. Ask each person whether the leading option works. Record their agreement on the shared screen. A new round clears these confirmations; the app never assumes that a ranking means consent.
8. For an illustrative empty-state test with no API calls, choose **Demo data**, then Chelsea, a 1 km radius and the lowest price tier. Regenerate. The app must show no option rather than relax a boundary.

## What to evaluate

The working Qloo pipeline and the reversible negotiation workflow are implemented. The command interpreter is deliberately rule-based; a language model is not connected. Demo venues are fictional and kept separate from live Qloo results. This is a shared-screen prototype, not a real-time multi-device voting app. Automated tests and live requests do not establish user satisfaction or product-market fit.
