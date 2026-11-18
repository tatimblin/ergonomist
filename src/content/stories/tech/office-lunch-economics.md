---
title: "Lunch and Learn: The Economics of the Office Lunch"
date: 2026-11-18
kind: article
dek: A method for estimating whether providing lunch pays for itself, using San Francisco prices and the federal tax rules for 2026.
kicker: Analysis
authors: [tristan-timblin]
tags: [office, lunch, taxes, economics]
veracity: reported
source: https://www.pwc.com/us/en/services/tax/library/pwc-limits-on-employer-deductions-for-certain-meals-effective-in-2026.html
---

This article estimates whether a company comes out ahead by providing lunch, either catered or as a DoorDash group order. The main results:

- At San Francisco prices, a $35 lunch pays for itself above a salary of about $164,000, counting only the work time it saves and the pay it replaces.
- Since January 1, companies can no longer deduct the cost of these meals. That raised the after-tax cost of each lunch by about 12%.
- Below that salary, lunch can still pay for itself through better work or lower turnover. At $150,000, it would take a productivity gain of about 0.4%, or one fewer departure a year for every 180 to 700 employees.

## The calculation

For each employee, each day, lunch pays for itself when:

> time value + pay value > meal cost

Time value is the work time lunch gives back. Pay value is the cash compensation it replaces. Both are multiplied by 0.79 below, because salary is deductible at the 21% federal corporate rate and, as of 2026, the meal is not.

The inputs:

| Input | Value | Basis |
| --- | --- | --- |
| Meal cost | $35 | San Francisco catering, including fees and tax |
| Minutes saved | 20 | Part of a 39-minute average lunch break |
| Value of the meal to the employee | $10 a day | Between a packed lunch and an $18 bought one |
| Employee's marginal tax rate | 40% | Federal, California and payroll taxes |
| Corporate tax rate | 21% | Federal only |
| Employer payroll tax | 7.65% | Below the Social Security wage base |
| Hours worked per year | 2,080 | 40 hours a week |

## Step 1: Meal cost

Zerocater quotes $20–35 a head for a recurring lunch program in San Francisco, and suggests adding 25–30% for service, delivery and tax ([Zerocater](https://zerocater.com/blog/office-catering-cost-san-francisco/)). The middle of both ranges is about $35. A DoorDash group order costs about the same: around $33 for an $18 lunch once markup, fees and tip are added, and a little less when the order shares one delivery fee.

Through 2025, a company could deduct half the cost of meals it provided for its own convenience. Section 274(o) of the tax code disallows the deduction entirely from 2026 ([PwC](https://www.pwc.com/us/en/services/tax/library/pwc-limits-on-employer-deductions-for-certain-meals-effective-in-2026.html)), so the after-tax cost of a $35 lunch is now $35.

## Step 2: Time value

The average lunch break is 39 minutes ([PR Newswire](https://prnewswire.com/news-releases/more-than-half-of-workers-take-30-minutes-or-less-for-lunch-survey-says-300709216.html)), and a good part of it goes to walking to a restaurant and waiting. With catering or a group order, someone brings the food to the cafeteria and posts in Slack that it has arrived, so that time can go back to work. We assume 20 minutes, valued at salary:

> time value = minutes saved ÷ 60 × salary ÷ 2,080 × 0.79

Packing a lunch doesn't avoid this time. It moves it from the workday to the evening before, into shopping, cooking and packing. For employees who meal prep, provided lunch still saves that time, and whether it goes to work or to personal time is often up to the employee. An evening without meal prep might absorb another errand, such as a pharmacy pickup or a trip to the post office, that they would otherwise have left work early for. Some of that time comes back to the workday, and the rest counts toward the pay value in Step 3.

## Step 3: Pay value

If employees treat lunch as part of their compensation, it replaces some cash the company would otherwise pay. Under Section 119, a meal the employer provides on its premises for its own convenience isn't taxable income to the employee, so lunch delivers that compensation more cheaply than salary does. For an employee to keep $10 after a 40% marginal rate, the company has to pay $16.67 in salary plus payroll tax on it, which costs about $14 after the corporate deduction:

> pay value = value to the employee ÷ (1 − marginal rate) × 1.0765 × 0.79

The value to the employee varies. Someone who would otherwise buy an $18 lunch values it at close to $18. Someone who packs a lunch values it at the cost of groceries plus the time spent preparing it. We use $10.

## Result

| Salary | Time value | Pay value | Total | Compared with $35 |
| --- | --- | --- | --- | --- |
| $150,000 | $18.99 | $14.17 | $33.16 | −$1.84 a day |
| $200,000 | $25.32 | $14.17 | $39.49 | +$4.49 a day |

Lunch pays for itself on these two benefits above a salary of about $164,000. At $150,000, it falls short by about $420 per employee per year.

## What the calculation leaves out

Two benefits could cover that shortfall. Neither is easy to measure.

**Collaboration.** When people from different teams eat at the same table, they hear about each other's work, and someone may learn that another team has already solved a problem they are working on. One client of an analytics firm found that developers who ate lunch in larger groups wrote 10% more code ([Michigan Public](https://www.michiganpublic.org/2015-05-20/how-a-bigger-lunch-table-at-work-can-boost-productivity)). At $150,000, a productivity gain of about 0.4% would cover the shortfall. This only applies if people eat together, which catering and group orders both make likely.

**Retention.** Gallup estimates that replacing an employee costs between half and twice their annual salary ([Gallup](https://www.gallup.com/workplace/247391/fixable-problem-costs-businesses.aspx)). An employee who would otherwise buy an $18 lunch every day would need about $6,900 more in salary to break even at a company that doesn't provide one, which makes leaving slightly less attractive. At $150,000, lunch would cover its shortfall if it prevented one departure a year for every 180 to 700 employees.

## Limitations

- **Tax treatment.** The pay value depends on the meal qualifying under Section 119, which the IRS reads narrowly. In a 2019 memo it rejected most of one company's reasons for feeding its whole staff ([SHRM](https://shrm.org/topics-tools/news/benefits-compensation/irs-says-let-eat-snacks)). A DoorDash budget that employees can spend anywhere is likely to count as taxable wages, in which case most of the pay value goes away.
- **Time saved.** Minutes count only if they turn into work. For people who already eat at their desks, the time value is close to zero.
- **Evidence.** The figures for collaboration and retention come from case studies and surveys, not controlled trials.
- **Scope.** The calculation uses federal corporate tax only. State taxes would raise the after-tax cost of the meal slightly.
