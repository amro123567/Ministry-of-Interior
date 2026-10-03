package com.moi.cts.repository;

import org.springframework.data.domain.Sort;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.repository.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Base repository for append-only history and audit tables.
 *
 * Unlike JpaRepository it deliberately has no delete or deleteAll methods, so
 * no code path can remove audit rows through the repository layer. Together
 * with Hibernate's @Immutable on the entities and the database triggers
 * created by AuditTableProtection, rows can be added and read but never
 * changed or removed.
 */
@NoRepositoryBean
public interface AppendOnlyRepository<T, ID> extends Repository<T, ID> {

    <S extends T> S save(S entity);

    <S extends T> List<S> saveAll(Iterable<S> entities);

    Optional<T> findById(ID id);

    List<T> findAll();

    List<T> findAll(Sort sort);

    boolean existsById(ID id);

    long count();
}
