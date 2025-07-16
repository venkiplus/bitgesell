import React, { useEffect, useState, useCallback, useRef } from "react";
import { FixedSizeList as List } from "react-window";
import { useData } from "../state/DataContext";
import { Link } from "react-router-dom";
import styles from "./Items.module.css";

const SkeletonRow = ({ index, style }) => (
  <div style={style} className={styles.skeletonRow}>
    <div
      className={`${styles.skeleton} ${styles.skeletonText}`}
      style={{ width: `${60 + (index % 4) * 10}%` }}
    />
  </div>
);

const ItemRow = ({ index, style, data }) => {
  const item = data[index];
  const firstLetter = item.name.charAt(0).toUpperCase();

  return (
    <div style={style}>
      {/* <Link
        to={`/items/${item.id}`}
        className={styles.itemLink}
        aria-describedby={`item-${item.id}-desc`}
      > */}
      <div className={styles.itemCard}>
        <div className={styles.itemIcon}>{firstLetter}</div>
        <div className={styles.itemContent}>
          <h3 className={styles.itemName}>{item.name}</h3>
          {/* <p className={styles.itemMeta}>
            Created{" "}
            {item.createdAt
              ? new Date(item.createdAt).toLocaleDateString()
              : "Recently"}
          </p> */}
        </div>
        <div className={styles.itemStats}>
          <span>ID: {item.id}</span>
        </div>
        <div className={styles.itemActions}>
          <button
            className={styles.actionButton}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Handle edit action
            }}
            title="Edit item"
          >
            ✏️
          </button>
          <button
            className={styles.actionButton}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Handle view action
            }}
            title="View details"
          >
            👁️
          </button>
        </div>
      </div>
      {/* </Link> */}
      {/* <span id={`item-${item.id}-desc`} className="sr-only">
        Navigate to details for {item.name}
      </span> */}
    </div>
  );
};

function Items() {
  const { items, pagination, loading, error, fetchItems } = useData();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const loadItems = useCallback(
    (page = 1, query = "") => {
      const abortController = new AbortController();

      fetchItems(abortController.signal, {
        page,
        limit: 50,
        q: query,
      }).catch((err) => {
        if (err.name !== "AbortError") {
          console.error(err);
        }
      });

      return () => abortController.abort();
    },
    [fetchItems]
  );

  useEffect(() => {
    const cleanup = loadItems(currentPage, searchQuery);
    return cleanup;
  }, [loadItems, currentPage, searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    const query = e.target.search.value;
    setSearchQuery(query);

    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  };

  const handleKeyDown = (e, page) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handlePageChange(page);
    }
  };

  const renderSkeletonList = () => (
    <div
      className={styles.listContainer}
      role="status"
      aria-label="Loading items"
    >
      <List height={400} itemCount={10} itemSize={57} ref={listRef}>
        {SkeletonRow}
      </List>
    </div>
  );

  const renderEmptyState = () => (
    <div className={styles.emptyState} role="status">
      <h3>No items found</h3>
      <p>
        {searchQuery
          ? `No results for "${searchQuery}". Try a different search term.`
          : "No items available at the moment."}
      </p>
    </div>
  );

  const renderErrorState = () => (
    <div className={styles.errorState} role="alert">
      <h3>Unable to load items</h3>
      <p>{error}</p>
      <button
        onClick={() => loadItems(currentPage, searchQuery)}
        className={styles.retryButton}
      >
        Try Again
      </button>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.mainContent}>
        <div className={styles.searchSection}>
          <div className={styles.searchHeader}>
            <h2 className={styles.searchTitle}>Search Items</h2>
            {pagination && (
              <div className={styles.searchStats}>
                Showing {items.length} of {pagination.total} items
                {searchQuery && ` matching "${searchQuery}"`}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSearch}
            className={styles.searchForm}
            role="search"
            aria-label="Search items"
          >
            <div className={styles.searchInputWrapper}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                id="search-input"
                ref={searchInputRef}
                name="search"
                type="text"
                placeholder="Search items by name..."
                defaultValue={searchQuery}
                className={styles.searchInput}
                aria-describedby="search-help"
              />
            </div>
            <button
              type="submit"
              className={styles.searchButton}
              aria-label="Submit search"
            >
              <span>Search</span>
              🚀
            </button>
          </form>
          <div id="search-help" className="sr-only">
            Enter search terms to filter the item list
          </div>
        </div>

        {loading && (
          <div
            className={styles.loadingIndicator}
            role="status"
            aria-live="polite"
          >
            <div className={styles.spinner} aria-hidden="true"></div>
            <span>Loading items...</span>
          </div>
        )}

        {error ? (
          renderErrorState()
        ) : loading && !items.length ? (
          renderSkeletonList()
        ) : items.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className={styles.listContainer}>
            <div className={styles.tableHeader}>
              <h3 className={styles.tableTitle}>
                {searchQuery
                  ? `Search Results (${items.length})`
                  : `All Items (${items.length})`}
              </h3>
              <div className={styles.viewToggle}>
                <button className={`${styles.viewButton} ${styles.active}`}>
                  📋 List
                </button>
                <button className={styles.viewButton}>🏷️ Cards</button>
              </div>
            </div>
            <List
              height={500}
              itemCount={items.length}
              itemSize={100}
              itemData={items}
              ref={listRef}
              role="list"
              aria-label={`Items list, ${items.length} items${
                searchQuery ? ` matching "${searchQuery}"` : ""
              }`}
            >
              {ItemRow}
            </List>
          </div>
        )}

        {pagination && (
          <nav
            className={styles.pagination}
            role="navigation"
            aria-label="Items pagination"
          >
            <div className={styles.paginationInfo}>
              <p className={styles.totalCount}>
                Total items: {pagination.total}
              </p>
              <p className={styles.pageInfo}>
                Page {pagination.page} of {pagination.totalPages}
              </p>
            </div>

            <div className={styles.paginationControls}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                onKeyDown={(e) => handleKeyDown(e, currentPage - 1)}
                disabled={!pagination.hasPrev}
                className={styles.pageButton}
                aria-label={`Go to previous page, page ${currentPage - 1}`}
              >
                ← Previous
              </button>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                onKeyDown={(e) => handleKeyDown(e, currentPage + 1)}
                disabled={!pagination.hasNext}
                className={styles.pageButton}
                aria-label={`Go to next page, page ${currentPage + 1}`}
              >
                Next →
              </button>
            </div>

            <div className={styles.pageJumper}>
              <span>Go to</span>
              <input
                type="number"
                min="1"
                max={pagination.totalPages}
                className={styles.pageInput}
                placeholder={pagination.page}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= pagination.totalPages) {
                      handlePageChange(page);
                    }
                  }
                }}
              />
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

export default Items;
