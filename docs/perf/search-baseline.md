# Member search - trigram index baseline

Measured on the seeded dataset: 12,400 members across 12 branches, Postgres 16 (Supabase, eu-central-1).

Query under test:

```sql
select id, full_name, member_code
from members
where deleted_at is null and full_name ilike '%mirje%'
limit 50;
```

## Result

| Configuration                                               | Access path       | Execution time |
| ----------------------------------------------------------- | ----------------- | -------------- |
| GIN trigram index on `full_name`                            | Bitmap Index Scan | **0.508 ms**   |
| Index disabled (`enable_bitmapscan`/`enable_indexscan` off) | Seq Scan          | **19.563 ms**  |

~38x on this query.

## Reading the plans honestly

Three caveats that matter more than the headline number:

1. **The sequential scan never finished.** `LIMIT 50` let it stop after examining 2,673 of 12,400 rows (`Rows Removed by Filter: 2623`). A scan that had to read the whole table would be slower still, so 38x is a floor for this pattern rather than a best case.

2. **Planning time dominates the indexed query** — 13.5 ms planning against 0.5 ms execution. At this row count the query is fast enough that the planner is the bottleneck. The index's value is that it holds as the dataset grows; the absolute numbers here are small either way.

3. **The planner's estimate was wrong.** It predicted 20 matching rows and found 225. Pattern-match selectivity is estimated crudely without extended statistics. It picked the right plan regardless.

## Unindexed plan

```text
Limit (cost=0.00..475.00 rows=20 width=62) (actual time=12.167..18.947 rows=50 loops=1)
-> Seq Scan on members (cost=0.00..475.00 rows=20 width=62) (actual time=12.165..18.939 rows=50 loops=1)
Filter: ((deleted_at IS NULL) AND (full_name ~~* '%mirje%'::text))
Rows Removed by Filter: 2623
Planning Time: 28.620 ms
Execution Time: 19.563 ms
```

## Indexed plan

```text
Limit  (cost=11.02..48.96 rows=50 width=44) (actual time=0.118..0.375 rows=50 loops=1)
  ->  Bitmap Heap Scan on members  (cost=11.02..180.98 rows=224 width=44) (actual time=0.117..0.369 rows=50 loops=1)
        Recheck Cond: (full_name ~~* '%mirje%'::text)
        Filter: (deleted_at IS NULL)
        Heap Blocks: exact=36
        ->  Bitmap Index Scan on members_full_name_trgm_idx  (cost=0.00..10.96 rows=224 width=0) (actual time=0.083..0.083 rows=225 loops=1)
              Index Cond: (full_name ~~* '%mirje%'::text)
Planning Time: 13.548 ms
Execution Time: 0.508 ms
```
