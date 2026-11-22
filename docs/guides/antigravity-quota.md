# See your Antigravity quota while you work

Antigravity CLI limits how much you can use each model over a 5-hour window and over a 7-day window. agy-powerline shows how much of each quota is left, when it resets and whether you are using it faster than time passes, in agy's status bar, on every refresh. Install it with `npx agy-powerline` and restart agy once.

- [The quota windows](#the-quota-windows)
- [Read the quota meters](#read-the-quota-meters)
- [Show only what you need](#show-only-what-you-need)
- [Get a warning before you run out](#get-a-warning-before-you-run-out)
- [Check your pace without a terminal](#check-your-pace-without-a-terminal)

## The quota windows

agy sends the state of each quota to the status line as a "bucket": the share left (`remaining_fraction`) and when it resets. The buckets seen so far:

| Bucket                    | Window          | Counts                                             |
| ------------------------- | --------------- | -------------------------------------------------- |
| `gemini-5h`               | 5 hours         | Gemini models                                      |
| `gemini-weekly`           | 7 days          | Gemini models                                      |
| `gemini-argon-wtu-weekly` | 7 days          | Gemini 4 Argon on Google AI Pro (no 5-hour window) |
| `3p-5h`, `3p-weekly`      | 5 hours, 7 days | Third-party models such as Claude and GPT          |

A bucket that doesn't apply right now can arrive marked `disabled`, and the bar hides it by default. When Antigravity marks `3p-5h` `disabled` while `3p-weekly` is at `0%`, you can either keep showing its payload value with `"showDisabled": true` on `thirdPartyFiveHour` or set `"zeroFiveHourWhenWeeklyEmpty": true` globally so all 5-hour quota widgets show `0.0% rem` (`100.0% used`) whenever their matching 7-day quota is at `0%`. The [payload reference](../payload.md#quota-buckets) has the details.

## Read the quota meters

The default bar puts the 5-hour and 7-day Gemini quotas on its second row, each with a reset timer:

```
⏳ •••••●••••••  72.0% rem   🔄 Reset: 2hr 47m
📅 •••••••••●••  21.0% rem   🔄 Reset: 1d 17h
```

The light dots fill from the left as you use quota. The larger dot `●` is the **pace marker**: it sits at the point of the window you have reached. With 2 hours of a 5-hour window gone, it sits at 40%.

- **Fill behind the marker** (the 5-hour meter above): you use quota slower than time passes. At this rate it lasts until the reset.
- **Fill past the marker** (the 7-day meter above): you use it faster. At this rate it runs out before the reset.

The marker needs no extra data: it comes from the reset time agy already sends and the fixed 5-hour and 7-day window lengths. More in [Quota pace marker](../configuration.md#quota-pace-marker).

## Show only what you need

- **The `quotas` preset** puts the plan and model first, the 5-hour and 7-day quotas side by side, and the third-party and Argon quotas below: `npx agy-powerline preset quotas`.
- **The `quota` widget** shows only the bucket closest to running out for the model in use, with its reset: `⏳ Quota: 7d 21.0% rem · 1d 17h`. The `compact` preset uses it to keep the bar on one line.
- **Percentages instead of meters:** `fiveHourPct` and `weeklyPct`.
- **Exact reset times** instead of a countdown: set the reset widgets to show the time, or both ([Reset times and clock](../configuration.md#reset-times-and-clock)).
- **Only when it gets low:** give a quota widget `showBelow`, for example `{ "id": "weeklyBar", "showBelow": 50 }`, and it stays hidden until half the quota is used.
- **Argon on Google AI Pro:** add `argonWeekly` and `argonReset` to see Argon's weekly quota even while you work with another model.

Add or remove any of them in `npx agy-powerline`, or in the [browser configurator](https://agy-powerline.com/configure/).

## Get a warning before you run out

Quota widgets turn to a caution color when 30% or less is left and to a danger color at 10%. Change the levels with `thresholds.quotaWarn` and `thresholds.quotaCrit`, per widget with `warn` and `crit`, and make a critical quota blink with `blink` ([Alerts and thresholds](../configuration.md#alerts-and-thresholds)).

The three colors stay distinct for color-blind users in the `colorblind-dark` and `colorblind-light` themes.

## Check your pace without a terminal

The [quota pace calculator](https://agy-powerline.com/quota-calculator/) does the same sum as the pace marker: enter the share left and the time until the reset, and it tells you whether the quota lasts until the reset and, if not, about when it runs out.
