/**
 * @file Contains all the client-side JavaScript for the property listing page.
 * This includes functionality for the image carousel, smooth scrolling navigation,
 * and event tracking.
 */

/* global getComputedStyle */

// Global variables for chart data and time range
let originalSalesData = [];
let originalTaxData = [];
let selectedTimeRange = "all"; // Default to show all data

/**
 * Handles the logic for displaying the next image in the carousel.
 * It finds the currently selected radio button and checks the next one in the sequence,
 * looping back to the beginning if the last image is currently displayed.
 */
// eslint-disable-next-line no-unused-vars

/**
 * Filters data by time range (years from current date)
 * @param {Array} data - Array of data objects with date property
 * @param {number|string} years - Number of years to include or 'all' for all data
 * @returns {Array} Filtered data
 */
function filterDataByTimeRange(data, years) {
  if (years === "all") {
    return data;
  }

  const currentDate = new Date();
  const cutoffDate = new Date();
  cutoffDate.setFullYear(currentDate.getFullYear() - years);

  return data.filter((item) => {
    const itemDate = new Date(item.date || item.year);
    return itemDate >= cutoffDate;
  });
}

/**
 * Displays a no-data message on the canvas
 * @param {HTMLCanvasElement} canvasElement - The canvas element
 * @param {string} message - The message to display
 */
function displayNoDataMessage(canvasElement, message) {
  const canvas = canvasElement.canvas || canvasElement;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  // Clear the canvas
  ctx.clearRect(0, 0, width, height);

  // Set up text styling
  ctx.font = "16px neue-haas-grotesk-display, system-ui, sans-serif";
  ctx.fillStyle = "#8e8b8b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw the message
  const lines = message.split("\n");
  const lineHeight = 24;
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineHeight);
  });
}

/**
 * Sets up time range selector functionality
 */
function setupTimeRangeSelector() {
  const timeRangeButtons = document.querySelectorAll(".time-range-btn");

  timeRangeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // Remove active class from all buttons
      timeRangeButtons.forEach((btn) => btn.classList.remove("active"));

      // Add active class to clicked button
      this.classList.add("active");

      // Update selected time range
      const yearsValue = this.getAttribute("data-years");
      selectedTimeRange = yearsValue === "all" ? "all" : parseInt(yearsValue);

      // Refresh both charts with new time range
      renderSalesPriceChart();
      renderTaxAssessmentChart();
    });
  });
}

function applySpacingToSalesData(rawSalesData) {
  return rawSalesData.map((entry, index, arr) => {
    const date = new Date(entry.date);
    const spacedDate = new Date(date);

    // Add spacing ONLY if two last points are too close
    if (arr.length >= 2) {
      const prev = new Date(arr[arr.length - 2].date);
      const last = new Date(arr[arr.length - 1].date);
      const diffInDays = (last - prev) / (1000 * 60 * 60 * 24);

      // Apply spacing only if < 90 days apart
      if (diffInDays < 90) {
        if (index === arr.length - 2)
          spacedDate.setDate(spacedDate.getDate() - 10);
        if (index === arr.length - 1)
          spacedDate.setDate(spacedDate.getDate() + 10);
      }
    }

    return {
      x: spacedDate,
      y: entry.amount,
      originalDate: entry.date,
      owner: entry.owner,
    };
  });
}
function nextImage() {
  // Get all radio buttons
  const radios = document.querySelectorAll('input[name="carousel-radio"]');

  let currentIndex = 0;
  for (let i = 0; i < radios.length; i++) {
    if (radios[i].checked) {
      currentIndex = i;
      break;
    }
  }

  // Calculate next index (loop back to 0 if at the end)
  const nextIndex = (currentIndex + 1) % radios.length;

  // Check the next radio button
  radios[nextIndex].checked = true;
}

/**
 * Tracks an event for analytics.
 * @param {string} eventName - The name of the event to track.
 * @param {object} eventProperties - Additional properties for the event.
 */
function trackEvent(eventName, eventProperties) {
  // Placeholder for a real analytics service like Google Analytics, Mixpanel, etc.
  // eslint-disable-next-line no-console
  console.log(`Tracking Event: ${eventName}`, eventProperties);
  // Example for GA:
  // if (typeof gtag === 'function') {
  //     gtag('event', eventName, eventProperties);
  // }
}

/**
 * Sets up smooth scrolling and active state handling for navigation tabs.
 * When a tab is clicked, it scrolls to the corresponding section
 * and marks the tab as active.
 */
function setupNavigation() {
  const navTabs = document.querySelectorAll(".nav-tab");

  navTabs.forEach((tab) => {
    tab.addEventListener("click", function (e) {
      e.preventDefault();

      // Remove active class from all tabs
      navTabs.forEach((t) => t.classList.remove("active"));
      // Add active class to clicked tab
      this.classList.add("active");

      // Get target section
      const targetId = this.getAttribute("href");
      const targetSection = document.querySelector(targetId);

      if (targetSection) {
        // Smooth scroll to section
        targetSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        trackEvent("navigation_click", { target: targetId });
      }
    });
  });
}

// eslint-disable-next-line no-unused-vars
function toggleMoreInfo() {
  const content = document.querySelector(".expanded-content");
  const arrow = document.querySelector(".dropdown-arrow");
  const button = document.querySelector(".less-info-btn span");

  if (content.style.display === "none") {
    content.style.display = "block";
    arrow.classList.add("rotated");
    button.textContent = "Less Info";
  } else {
    content.style.display = "none";
    arrow.classList.remove("rotated");
    button.textContent = "More Info";
  }
}

/**
 * Toggles the display of additional sale events
 */
// eslint-disable-next-line no-unused-vars
function toggleMoreSalesData() {
  const additionalSales = document.querySelector(".additional-sale-events");
  const button = document.querySelector(".show-more-sales-btn");
  const buttonText = button.querySelector("span");
  const arrow = button.querySelector("img");

  if (additionalSales.style.display === "none") {
    additionalSales.style.display = "block";
    buttonText.textContent = "Show Less Sale Events";
    arrow.style.transform = "rotate(180deg)";
  } else {
    additionalSales.style.display = "none";
    buttonText.textContent = "Show More Sale Events";
    arrow.style.transform = "rotate(0deg)";
  }
}

/**
 * Toggles the display of additional tax years
 */
// eslint-disable-next-line no-unused-vars
function toggleMoreTaxData() {
  const additionalTaxes = document.querySelector(".additional-tax-years");
  const button = document.querySelector(".show-more-tax-btn");
  const buttonText = button.querySelector("span");
  const arrow = button.querySelector("img");

  if (additionalTaxes.style.display === "none") {
    additionalTaxes.style.display = "block";
    buttonText.textContent = "Show Less Tax Years";
    arrow.style.transform = "rotate(180deg)";
  } else {
    additionalTaxes.style.display = "none";
    buttonText.textContent = "Show More Tax Years";
    arrow.style.transform = "rotate(0deg)";
  }
}

/**
 * Toggles provider information display
 */
// eslint-disable-next-line no-unused-vars
function toggleProviderInfo(button) {
  const providerItem = button.closest(".provider-item");
  const expandedContent = providerItem.querySelector(
    ".provider-expanded-content",
  );
  const buttonText = button.querySelector("span");
  const arrow = button.querySelector("img");

  if (expandedContent.style.display === "none") {
    expandedContent.style.display = "block";
    buttonText.textContent = "Less Info";
    arrow.style.transform = "rotate(180deg)";
  } else {
    expandedContent.style.display = "none";
    buttonText.textContent = "More Info";
    arrow.style.transform = "rotate(0deg)";
  }
}

/**
 * Sets up click listeners for chart tabs.
 */
function setupChartTabs() {
  const tabs = document.querySelectorAll(".chart-tab");
  const chartContents = document.querySelectorAll(".chart-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabType = tab.getAttribute("data-tab");

      // Remove active class from all tabs and contents
      tabs.forEach((t) => t.classList.remove("active"));
      chartContents.forEach((content) => content.classList.remove("active"));

      // Add active class to clicked tab
      tab.classList.add("active");

      // Show corresponding chart content
      if (tabType === "sales") {
        const salesContent = document.getElementById("sales-chart-content");
        if (salesContent) {
          salesContent.classList.add("active");
          // Refresh the sales chart when switching to it
          if (window.salesChart) {
            window.salesChart.resize();
          }
        }
      } else if (tabType === "tax") {
        const taxContent = document.getElementById("tax-chart-content");
        if (taxContent) {
          taxContent.classList.add("active");
          // Refresh the tax chart when switching to it
          if (window.taxChart) {
            window.taxChart.resize();
          }
        }
      }
    });
  });
}

/**
 * Helper function to get CSS custom property with fallback
 */
function getCSSVar(property, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    property,
  );
  return value ? value.trim() : fallback;
}

/**
 * Creates a Chart.js plugin for positioning price labels with intelligent placement
 * to avoid overlaps and stay within chart bounds
 */
function createPriceLabelsPlugin(pluginId) {
  return {
    id: pluginId,
    afterDatasetsDraw(chart, _args, _pluginOptions) {
      const { ctx, chartArea } = chart;
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = `${getCSSVar("--chart-price-label-size", "12")}px ${getCSSVar("--chart-font-family", "neue-haas-grotesk-display, system-ui, sans-serif")}`;
      ctx.fillStyle = getCSSVar("--chart-price-label-color", "#423e3e");

      const yStackMap = new Map(); // Track how many labels are stacked per x pixel

      // Store label positions to check for overlaps
      const labelPositions = [];

      meta.data.forEach((point, i) => {
        const dataPoint = dataset.data[i];
        const value = dataPoint?.y ?? dataPoint;
        if (value == null || isNaN(value) || value === null) return;

        const x = point.x;
        const y = point.y;
        // Format label as $XXX.Xk
        const label = `$${(value / 1000).toFixed(1)}k`;

        // Measure text dimensions
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const textHeight = parseInt(
          getCSSVar("--chart-price-label-size", "12"),
        );

        // Determine intelligent position priority based on data point location
        let positions = [];

        // Check if this point is near the top of the chart (good for below positioning)
        const isNearTop = y < chartArea.top + 50;
        // Check if this point is near the bottom of the chart (good for above positioning)
        const isNearBottom = y > chartArea.bottom - 50;
        // Check if this point is near the left edge (good for right positioning)
        const isNearLeft = x < chartArea.left + 80;
        // Check if this point is near the right edge (good for left positioning)
        const isNearRight = x > chartArea.right - 80;

        // Build position array based on chart location
        let stackCount = 0;
        let stackKey = null;

        // Find if an existing stack exists nearby (within ±10px)
        for (const [key, count] of yStackMap.entries()) {
          if (Math.abs(key - x) < 10) {
            stackKey = key;
            stackCount = count;
            break;
          }
        }

        // If no nearby x found, use this x as new stackKey
        if (stackKey === null) {
          stackKey = x;
          stackCount = 0;
        }

        const offsetY = -stackCount * 24;
        yStackMap.set(stackKey, stackCount + 1);

        if (isNearTop) {
          positions = [
            { x, y: y + 16 + offsetY, align: "center", baseline: "top" },
            { x: x + 16, y: y + offsetY, align: "left", baseline: "middle" },
            { x: x - 16, y: y + offsetY, align: "right", baseline: "middle" },
            { x, y: y - 16 + offsetY, align: "center", baseline: "bottom" },
          ];
        } else if (isNearBottom) {
          positions = [
            { x, y: y - 16 + offsetY, align: "center", baseline: "bottom" },
            { x: x + 16, y: y + offsetY, align: "left", baseline: "middle" },
            { x: x - 16, y: y + offsetY, align: "right", baseline: "middle" },
            { x, y: y + 16 + offsetY, align: "center", baseline: "top" },
          ];
        } else if (isNearLeft) {
          positions = [
            { x: x + 16, y: y + offsetY, align: "left", baseline: "middle" },
            { x, y: y - 16 + offsetY, align: "center", baseline: "bottom" },
            { x, y: y + 16 + offsetY, align: "center", baseline: "top" },
            { x: x - 16, y: y + offsetY, align: "right", baseline: "middle" },
          ];
        } else if (isNearRight) {
          positions = [
            { x: x - 16, y: y + offsetY, align: "right", baseline: "middle" },
            { x, y: y - 16 + offsetY, align: "center", baseline: "bottom" },
            { x, y: y + 16 + offsetY, align: "center", baseline: "top" },
            { x: x + 16, y: y + offsetY, align: "left", baseline: "middle" },
          ];
        } else {
          positions = [
            { x, y: y - 16 + offsetY, align: "center", baseline: "bottom" },
            { x, y: y + 16 + offsetY, align: "center", baseline: "top" },
            { x: x + 16, y: y + offsetY, align: "left", baseline: "middle" },
            { x: x - 16, y: y + offsetY, align: "right", baseline: "middle" },
          ];
        }

        // Check for overlap with existing labels and chart line
        let bestPosition = positions[0];
        let minOverlap = Infinity;

        positions.forEach((pos) => {
          const labelBounds = {
            left:
              pos.x -
              (pos.align === "center"
                ? textWidth / 2
                : pos.align === "right"
                  ? textWidth
                  : 0),
            right:
              pos.x +
              (pos.align === "center"
                ? textWidth / 2
                : pos.align === "left"
                  ? textWidth
                  : 0),
            top:
              pos.y -
              (pos.baseline === "middle"
                ? textHeight / 2
                : pos.baseline === "bottom"
                  ? textHeight
                  : 0),
            bottom:
              pos.y +
              (pos.baseline === "middle"
                ? textHeight / 2
                : pos.baseline === "top"
                  ? textHeight
                  : 0),
          };

          // Check overlap with existing labels
          let totalOverlap = 0;
          let hasOverlap = false;
          labelPositions.forEach((existingLabel) => {
            const overlap =
              Math.max(
                0,
                Math.min(labelBounds.right, existingLabel.right) -
                  Math.max(labelBounds.left, existingLabel.left),
              ) *
              Math.max(
                0,
                Math.min(labelBounds.bottom, existingLabel.bottom) -
                  Math.max(labelBounds.top, existingLabel.top),
              );
            totalOverlap += overlap;
            if (overlap > 0) hasOverlap = true;
          });

          // Check if position is within chart area with padding
          const padding = 5;
          const withinBounds =
            labelBounds.left >= chartArea.left + padding &&
            labelBounds.right <= chartArea.right - padding &&
            labelBounds.top >= chartArea.top + padding &&
            labelBounds.bottom <= chartArea.bottom - padding;

          // Prefer positions with no overlap and within bounds
          if (withinBounds && !hasOverlap) {
            bestPosition = pos;
            minOverlap = 0;
            return; // Found a perfect position, use it
          } else if (withinBounds && totalOverlap < minOverlap) {
            minOverlap = totalOverlap;
            bestPosition = pos;
          }
        });

        // If all standard positions have overlaps, try diagonal positions within 16px
        if (minOverlap > 0) {
          const fallbackPositions = [
            { x: x + 12, y: y + 12, align: "left", baseline: "top" }, // Diagonal bottom-right
            { x: x - 12, y: y + 12, align: "right", baseline: "top" }, // Diagonal bottom-left
            { x: x + 12, y: y - 12, align: "left", baseline: "bottom" }, // Diagonal top-right
            { x: x - 12, y: y - 12, align: "right", baseline: "bottom" }, // Diagonal top-left
          ];

          fallbackPositions.forEach((pos) => {
            const labelBounds = {
              left:
                pos.x -
                (pos.align === "center"
                  ? textWidth / 2
                  : pos.align === "right"
                    ? textWidth
                    : 0),
              right:
                pos.x +
                (pos.align === "center"
                  ? textWidth / 2
                  : pos.align === "left"
                    ? textWidth
                    : 0),
              top:
                pos.y -
                (pos.baseline === "middle"
                  ? textHeight / 2
                  : pos.baseline === "bottom"
                    ? textHeight
                    : 0),
              bottom:
                pos.y +
                (pos.baseline === "middle"
                  ? textHeight / 2
                  : pos.baseline === "top"
                    ? textHeight
                    : 0),
            };

            let totalOverlap = 0;
            let hasOverlap = false;
            labelPositions.forEach((existingLabel) => {
              const overlap =
                Math.max(
                  0,
                  Math.min(labelBounds.right, existingLabel.right) -
                    Math.max(labelBounds.left, existingLabel.left),
                ) *
                Math.max(
                  0,
                  Math.min(labelBounds.bottom, existingLabel.bottom) -
                    Math.max(labelBounds.top, existingLabel.top),
                );
              totalOverlap += overlap;
              if (overlap > 0) hasOverlap = true;
            });

            const padding = 5;
            const withinBounds =
              labelBounds.left >= chartArea.left + padding &&
              labelBounds.right <= chartArea.right - padding &&
              labelBounds.top >= chartArea.top + padding &&
              labelBounds.bottom <= chartArea.bottom - padding;

            if (withinBounds && !hasOverlap) {
              bestPosition = pos;
              minOverlap = 0;
              return;
            } else if (withinBounds && totalOverlap < minOverlap) {
              minOverlap = totalOverlap;
              bestPosition = pos;
            }
          });
        }

        // Set text alignment and baseline
        ctx.textAlign = bestPosition.align;
        ctx.textBaseline = bestPosition.baseline;

        // Draw the label
        ctx.fillText(label, bestPosition.x, bestPosition.y);

        // Store this label's position for future overlap checks
        const textMetrics2 = ctx.measureText(label);
        labelPositions.push({
          left:
            bestPosition.x -
            (bestPosition.align === "center"
              ? textMetrics2.width / 2
              : bestPosition.align === "right"
                ? textMetrics2.width
                : 0),
          right:
            bestPosition.x +
            (bestPosition.align === "center"
              ? textMetrics2.width / 2
              : bestPosition.align === "left"
                ? textMetrics2.width
                : 0),
          top:
            bestPosition.y -
            (bestPosition.baseline === "middle"
              ? textHeight / 2
              : bestPosition.baseline === "bottom"
                ? textHeight
                : 0),
          bottom:
            bestPosition.y +
            (bestPosition.baseline === "middle"
              ? textHeight / 2
              : bestPosition.baseline === "top"
                ? textHeight
                : 0),
        });
      });

      ctx.restore();
    },
  };
}

/**
 * Sets up the sales price chart using Chart.js
 */
function renderSalesPriceChart() {
  const ctx = document.getElementById("salesPriceChart");
  if (!ctx) return;

  // Clear any existing chart
  if (window.salesChart) {
    window.salesChart.destroy();
  }

  const context = ctx.getContext("2d");

  // Get sales data from the page
  const salesElements = document.querySelectorAll(".history-sale");
  const salesData = [];

  // eslint-disable-next-line no-console
  console.log("Found sales elements:", salesElements.length);

  salesElements.forEach((element) => {
    const priceElement = element.querySelector(".history-price");
    const dateElement = element.querySelector(".history-date");
    const entityElement = element.querySelector(".history-entity");

    if (priceElement && dateElement) {
      const priceText = priceElement.textContent.replace(/[$,]/g, "");
      const price = parseFloat(priceText);
      const date = dateElement.textContent;
      const owner = entityElement
        ? entityElement.textContent.replace(/^-?\s*/, "")
        : null;

      // eslint-disable-next-line no-console
      console.log("Processing sale:", { price, date, owner });

      if (!isNaN(price) && date) {
        salesData.push({
          date: date,
          amount: price,
          owner: owner,
        });
      }
    }
  });

  // Store original data if not already stored
  if (originalSalesData.length === 0) {
    originalSalesData = [...salesData];
  }

  // eslint-disable-next-line no-console
  console.log("Final sales data:", salesData);

  // Sort by date (oldest first)
  salesData.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });

  // Filter data by selected time range
  const filteredSalesData = filterDataByTimeRange(salesData, selectedTimeRange);

  // Check if we have data after filtering
  if (filteredSalesData.length === 0) {
    displayNoDataMessage(
      ctx,
      "No sales data available for the selected time period.\nPlease select a different time range.",
    );
    return;
  }

  const spacedSalesData = applySpacingToSalesData(filteredSalesData);
  // Extract only the year from the date string for x-axis labels
  const labels = filteredSalesData.map((entry) => {
    // Try to extract a 4-digit year from the string
    const match = entry.date.match(/\d{4}/);
    return match ? match[0] : entry.date;
  });
  const prices = filteredSalesData.map((entry) => entry.amount);

  // Add current year to the timeline if it's not already present
  const currentYear = new Date().getFullYear().toString();
  if (!labels.includes(currentYear)) {
    labels.push(currentYear);
    prices.push(null); // No price data for current year
  }

  // Check if Chart.js is available
  if (typeof Chart === "undefined") {
    // eslint-disable-next-line no-console
    console.warn("Chart.js is not loaded. Chart will not be rendered.");
    return;
  }

  // eslint-disable-next-line no-undef
  window.salesChart = new Chart(context, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Sale Price",
          data: spacedSalesData,

          // Add metadata for tooltips
          saleData: filteredSalesData,
          fill: false,
          borderColor: getCSSVar("--chart-line-color", "#4b82d4"),
          backgroundColor: getCSSVar(
            "--chart-fill-color",
            "rgba(75, 130, 212, 0.1)",
          ),
          borderWidth: parseInt(getCSSVar("--chart-line-width", "2")),
          pointBackgroundColor: getCSSVar("--chart-point-bg-color", "#4b82d4"),
          pointBorderWidth: 0,
          pointRadius: parseInt(getCSSVar("--chart-point-radius", "6")),
          pointHoverRadius: parseInt(
            getCSSVar("--chart-point-hover-radius", "8"),
          ),
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: getCSSVar(
            "--chart-tooltip-bg",
            "rgba(0, 0, 0, 0.9)",
          ),
          titleColor: getCSSVar("--chart-tooltip-title-color", "#ffffff"),
          bodyColor: getCSSVar("--chart-tooltip-body-color", "#ffffff"),
          borderWidth: 0,
          cornerRadius: parseInt(getCSSVar("--chart-tooltip-radius", "12")),
          displayColors: false,
          padding: {
            x: parseInt(getCSSVar("--chart-tooltip-padding-x", "12")),
            y: parseInt(getCSSVar("--chart-tooltip-padding-y", "8")),
          },
          titleFont: {
            family: getCSSVar(
              "--chart-font-family",
              "neue-haas-grotesk-display, system-ui, sans-serif",
            ),
            size: parseInt(getCSSVar("--chart-tooltip-title-size", "14")),
            weight: getCSSVar("--chart-tooltip-title-weight", "600"),
          },
          bodyFont: {
            family: getCSSVar(
              "--chart-font-family",
              "neue-haas-grotesk-display, system-ui, sans-serif",
            ),
            size: parseInt(getCSSVar("--chart-tooltip-body-size", "12")),
            weight: getCSSVar("--chart-tooltip-body-weight", "400"),
          },
          enabled: true,
          mode: "nearest",
          intersect: true,
          animation: false,
          callbacks: {
            title: function (tooltipItems) {
              // eslint-disable-next-line no-console
              console.log("Tooltip title callback:", tooltipItems);
              const tooltipItem = tooltipItems[0];
              if (
                tooltipItem &&
                tooltipItem.dataset &&
                tooltipItem.dataset.saleData
              ) {
                const saleData =
                  tooltipItem.dataset.saleData[tooltipItem.dataIndex];
                // eslint-disable-next-line no-console
                console.log("Sale data for tooltip:", saleData);
                return saleData ? saleData.date : tooltipItem.label;
              }
              return tooltipItem ? tooltipItem.label : "";
            },
            label: function (tooltipItem) {
              // eslint-disable-next-line no-console
              console.log("Tooltip label callback:", tooltipItem);
              if (
                tooltipItem &&
                tooltipItem.dataset &&
                tooltipItem.dataset.saleData
              ) {
                const saleData =
                  tooltipItem.dataset.saleData[tooltipItem.dataIndex];
                const lines = [];

                lines.push(
                  "Sale Price: $" + tooltipItem.parsed.y.toLocaleString(),
                );

                if (saleData && saleData.owner) {
                  const ownerString = saleData.owner.trim();

                  // Check if there are multiple owners (contains semicolon)
                  const hasMultipleOwners = ownerString.includes(";");
                  const label = hasMultipleOwners ? "Owners: " : "Owner: ";

                  lines.push(label + ownerString);
                }

                // eslint-disable-next-line no-console
                console.log("Tooltip lines:", lines);
                return lines;
              }
              return ["Sale Price: $" + tooltipItem.parsed.y.toLocaleString()];
            },
          },
        },
        // Custom plugin to draw price labels below each point
        datalabelsBelow: false, // just a placeholder for config
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "year", // Or 'month' for more granularity
          },
          grid: {
            display: getCSSVar("--chart-grid-line-display", "false") === "true",
            color: getCSSVar("--chart-grid-line-color", "#f0f0f0"),
            lineWidth: parseInt(getCSSVar("--chart-grid-line-width", "1")),
          },
          border: {
            display: getCSSVar("--chart-axis-line-display", "true") === "true",
            color: getCSSVar("--chart-axis-line-color", "#d9d8d8"),
            width: parseInt(getCSSVar("--chart-axis-line-width", "1")),
          },
          ticks: {
            stepSize: 5, // 👈 shows ticks every 5 years
            source: "auto", // lets Chart.js choose tick placement based on data
            autoSkip: true, // skips overlapping labels
            maxTicksLimit: 10, // optional: prevents over-crowding
            color: getCSSVar("--chart-axis-color", "#8e8b8b"),
            font: {
              family: getCSSVar(
                "--chart-font-family",
                "neue-haas-grotesk-display, system-ui, sans-serif",
              ),
              size: parseInt(getCSSVar("--chart-axis-font-size", "12")),
              weight: getCSSVar("--chart-axis-font-weight", "400"),
            },
          },
        },
        y: {
          beginAtZero: false,
          display: getCSSVar("--chart-grid-line-display", "false") === "true",
          grid: {
            display: getCSSVar("--chart-grid-line-display", "false") === "true",
            color: getCSSVar("--chart-grid-line-color", "#f0f0f0"),
            lineWidth: parseInt(getCSSVar("--chart-grid-line-width", "1")),
          },
        },
      },
      elements: {
        point: {
          hoverBackgroundColor: getCSSVar("--chart-point-hover-bg", "#4b82d4"),
        },
      },
    },
    plugins: [createPriceLabelsPlugin("priceLabelsBelow")],
  });
}

/**
 * Sets up the tax assessment chart using Chart.js
 */
function renderTaxAssessmentChart() {
  const ctx = document.getElementById("taxAssessmentChart");
  if (!ctx) return;

  // Clear any existing chart
  if (window.taxChart) {
    window.taxChart.destroy();
  }

  const context = ctx.getContext("2d");

  // Get tax data from the page
  const taxElements = document.querySelectorAll(".tax-year-section");
  const taxData = [];

  // eslint-disable-next-line no-console
  console.log("Found tax elements:", taxElements.length);

  taxElements.forEach((element) => {
    const yearElement = element.querySelector(".tax-year-header");
    const assessedValueElement = element.querySelector(".tax-value");

    if (yearElement && assessedValueElement) {
      const yearText = yearElement.textContent.match(/Tax Year (\d+)/);
      const valueText = assessedValueElement.textContent.replace(/[$,]/g, "");
      const value = parseFloat(valueText);

      // eslint-disable-next-line no-console
      console.log("Processing tax:", {
        year: yearText ? yearText[1] : null,
        value,
      });

      if (yearText && !isNaN(value)) {
        taxData.push({
          year: yearText[1],
          assessedValue: value,
          element: element,
        });
      }
    }
  });

  // Store original data if not already stored
  if (originalTaxData.length === 0) {
    originalTaxData = [...taxData];
  }

  // eslint-disable-next-line no-console
  console.log("Final tax data:", taxData);

  // Sort by year (oldest first)
  taxData.sort((a, b) => parseInt(a.year) - parseInt(b.year));

  // Filter data by selected time range
  const filteredTaxData = filterDataByTimeRange(taxData, selectedTimeRange);

  // Check if we have data after filtering
  if (filteredTaxData.length === 0) {
    displayNoDataMessage(
      ctx,
      "No tax data available for the selected time period.\nPlease select a different time range.",
    );
    return;
  }

  // Extract years and assessed values
  const labels = filteredTaxData.map((entry) => entry.year);
  const assessedValues = filteredTaxData.map((entry) => entry.assessedValue);

  // Add current year to the timeline if it's not already present
  const currentYear = new Date().getFullYear().toString();
  if (!labels.includes(currentYear)) {
    labels.push(currentYear);
    assessedValues.push(null); // No data for current year
  }

  // Check if Chart.js is available
  if (typeof Chart === "undefined") {
    // eslint-disable-next-line no-console
    console.warn("Chart.js is not loaded. Tax chart will not be rendered.");
    return;
  }

  // eslint-disable-next-line no-undef
  window.taxChart = new Chart(context, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Assessed Value",
          data: assessedValues,
          // Add metadata for tooltips
          taxData: filteredTaxData,
          fill: false,
          borderColor: getCSSVar("--chart-line-color", "#4b82d4"),
          backgroundColor: getCSSVar(
            "--chart-fill-color",
            "rgba(75, 130, 212, 0.1)",
          ),
          borderWidth: parseInt(getCSSVar("--chart-line-width", "2")),
          pointBackgroundColor: getCSSVar("--chart-point-bg-color", "#4b82d4"),
          pointBorderWidth: 0,
          pointRadius: parseInt(getCSSVar("--chart-point-radius", "6")),
          pointHoverRadius: parseInt(
            getCSSVar("--chart-point-hover-radius", "8"),
          ),
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: getCSSVar(
            "--chart-tooltip-bg",
            "rgba(0, 0, 0, 0.9)",
          ),
          titleColor: getCSSVar("--chart-tooltip-title-color", "#ffffff"),
          bodyColor: getCSSVar("--chart-tooltip-body-color", "#ffffff"),
          borderWidth: 0,
          cornerRadius: parseInt(getCSSVar("--chart-tooltip-radius", "12")),
          displayColors: false,
          padding: {
            x: parseInt(getCSSVar("--chart-tooltip-padding-x", "12")),
            y: parseInt(getCSSVar("--chart-tooltip-padding-y", "8")),
          },
          titleFont: {
            family: getCSSVar(
              "--chart-font-family",
              "neue-haas-grotesk-display, system-ui, sans-serif",
            ),
            size: parseInt(getCSSVar("--chart-tooltip-title-size", "14")),
            weight: getCSSVar("--chart-tooltip-title-weight", "600"),
          },
          bodyFont: {
            family: getCSSVar(
              "--chart-font-family",
              "neue-haas-grotesk-display, system-ui, sans-serif",
            ),
            size: parseInt(getCSSVar("--chart-tooltip-body-size", "12")),
            weight: getCSSVar("--chart-tooltip-body-weight", "400"),
          },
          enabled: true,
          mode: "nearest",
          intersect: true,
          animation: false,
          callbacks: {
            title: function (tooltipItems) {
              const tooltipItem = tooltipItems[0];
              if (
                tooltipItem &&
                tooltipItem.dataset &&
                tooltipItem.dataset.taxData
              ) {
                const taxData =
                  tooltipItem.dataset.taxData[tooltipItem.dataIndex];
                return taxData ? `Tax Year ${taxData.year}` : tooltipItem.label;
              }
              return tooltipItem ? tooltipItem.label : "";
            },
            label: function (tooltipItem) {
              if (
                tooltipItem &&
                tooltipItem.dataset &&
                tooltipItem.dataset.taxData
              ) {
                const taxData =
                  tooltipItem.dataset.taxData[tooltipItem.dataIndex];
                const lines = [];

                lines.push(
                  "Assessed Value: $" + tooltipItem.parsed.y.toLocaleString(),
                );

                if (taxData && taxData.element) {
                  // Get all tax values from the DOM element
                  // Note: These elements are queried but not used directly - values are extracted via regex instead

                  // Try to find market value
                  const marketValueText = taxData.element.textContent.match(
                    /Market Value:\s*\$([\d,]+)/,
                  );
                  if (marketValueText) {
                    lines.push("Market Value: $" + marketValueText[1]);
                  }

                  // Try to find building value
                  const buildingValueText = taxData.element.textContent.match(
                    /Building Value:\s*\$([\d,]+)/,
                  );
                  if (buildingValueText) {
                    lines.push("Building Value: $" + buildingValueText[1]);
                  }

                  // Try to find land value
                  const landValueText = taxData.element.textContent.match(
                    /Land Value:\s*\$([\d,]+)/,
                  );
                  if (landValueText) {
                    lines.push("Land Value: $" + landValueText[1]);
                  }

                  // Try to find taxable value
                  const taxableValueText = taxData.element.textContent.match(
                    /Taxable Value:\s*\$([\d,]+)/,
                  );
                  if (taxableValueText) {
                    lines.push("Taxable Value: $" + taxableValueText[1]);
                  }

                  // Try to find monthly tax
                  const monthlyTaxText = taxData.element.textContent.match(
                    /Monthly Tax:\s*\$([\d,]+)/,
                  );
                  if (monthlyTaxText) {
                    lines.push("Monthly Tax: $" + monthlyTaxText[1]);
                  }
                }

                return lines;
              }
              return [
                "Assessed Value: $" + tooltipItem.parsed.y.toLocaleString(),
              ];
            },
          },
        },
        // Custom plugin to draw price labels below each point
        datalabelsBelow: false, // just a placeholder for config
      },
      scales: {
        x: {
          type: "category",
          grid: {
            display: getCSSVar("--chart-grid-line-display", "false") === "true",
            color: getCSSVar("--chart-grid-line-color", "#f0f0f0"),
            lineWidth: parseInt(getCSSVar("--chart-grid-line-width", "1")),
          },
          border: {
            display: getCSSVar("--chart-axis-line-display", "true") === "true",
            color: getCSSVar("--chart-axis-line-color", "#d9d8d8"),
            width: parseInt(getCSSVar("--chart-axis-line-width", "1")),
          },
          ticks: {
            color: getCSSVar("--chart-axis-color", "#8e8b8b"),
            font: {
              family: getCSSVar(
                "--chart-font-family",
                "neue-haas-grotesk-display, system-ui, sans-serif",
              ),
              size: parseInt(getCSSVar("--chart-axis-font-size", "12")),
              weight: getCSSVar("--chart-axis-font-weight", "400"),
            },
          },
        },
        y: {
          beginAtZero: false,
          display: getCSSVar("--chart-grid-line-display", "false") === "true",
          grid: {
            display: getCSSVar("--chart-grid-line-display", "false") === "true",
            color: getCSSVar("--chart-grid-line-color", "#f0f0f0"),
            lineWidth: parseInt(getCSSVar("--chart-grid-line-width", "1")),
          },
        },
      },
      elements: {
        point: {
          hoverBackgroundColor: getCSSVar("--chart-point-hover-bg", "#4b82d4"),
        },
      },
    },
    plugins: [createPriceLabelsPlugin("taxPriceLabelsBelow")],
  });
}

// eslint-disable-next-line no-unused-vars
function togglePriceCardInfo(btn) {
  const expanded = btn.getAttribute("aria-expanded") === "true";
  btn.setAttribute("aria-expanded", !expanded);
  const card = btn.closest(".price-card");
  const content = card.querySelector(".expanded-content");
  if (!expanded) {
    content.style.display = "block";
    btn.innerHTML =
      'Less Info <img src="https://elephant.xyz/homes/public/dropdown-arrow.svg" alt="Collapse" class="expander-icon">';
  } else {
    content.style.display = "none";
    btn.innerHTML =
      'More Info <img src="https://elephant.xyz/homes/public/dropdown-arrow.svg" alt="Expand" class="expander-icon">';
  }
}

// eslint-disable-next-line no-unused-vars
function toggleSalesEvents(btn) {
  const salesColumn = btn.closest("#sales-events-column");
  const hiddenEvents = salesColumn.querySelectorAll(".sale-event-hidden");
  const isExpanded = btn.classList.contains("expanded");

  if (!isExpanded) {
    hiddenEvents.forEach((ev) => (ev.style.display = "flex"));
    btn.classList.add("expanded");
    btn.innerHTML =
      'Show Less <img src="https://elephant.xyz/homes/public/dropdown-arrow.svg" class="show-arrow rotated" alt="Collapse">';
  } else {
    hiddenEvents.forEach((ev) => (ev.style.display = "none"));
    btn.classList.remove("expanded");
    btn.innerHTML =
      'Show More <img src="https://elephant.xyz/homes/public/dropdown-arrow.svg" class="show-arrow" alt="Expand">';
  }
}

/**
 * Refreshes the sales price chart to apply new CSS custom properties
 */
// eslint-disable-next-line no-unused-vars
function refreshSalesChart() {
  renderSalesPriceChart();
}

/**
 * Refreshes the tax assessment chart to apply new CSS custom properties
 */
// eslint-disable-next-line no-unused-vars
function refreshTaxChart() {
  renderTaxAssessmentChart();
}

// Hide navigation if page content does not exceed viewport height
function toggleNavigationOnShortPage() {
  const nav = document.getElementById("main-navigation");
  if (!nav) return;
  if (document.body.scrollHeight <= window.innerHeight) {
    nav.style.display = "none";
  } else {
    nav.style.display = "";
  }
}

/**
 * Toggles the display of floor sections (1st Floor, 2nd Floor, Other Rooms)
 * @param {HTMLElement} header - The floor header element that was clicked
 */
// eslint-disable-next-line no-unused-vars
function toggleFloorSection(header) {
  const content = header.nextElementSibling;
  const arrow = header.querySelector(".collapse-arrow");

  content.classList.toggle("expanded");
  arrow.classList.toggle("rotated");
}

/**
 * Initializes all the JavaScript functionality when the DOM is loaded.
 */
/**
 * Handles sticky providers card behavior and condensed navigation version
 */
function setupStickyProviders() {
  const providersCard = document.querySelector(".providers-card");
  const sidebar = document.querySelector(".sidebar");
  const condensedProviders = document.getElementById("nav-providers-condensed");
  const propertyHistorySection = document.getElementById("property-history");

  if (
    !providersCard ||
    !sidebar ||
    !condensedProviders ||
    !propertyHistorySection
  ) {
    return;
  }

  let isSticky = true;
  let sidebarOriginalTop = null;
  let transitionPoint = null;

  // Get the sidebar's original position in document flow
  function getSidebarOriginalTop() {
    if (sidebarOriginalTop === null) {
      const rect = sidebar.getBoundingClientRect();
      sidebarOriginalTop = window.pageYOffset + rect.top;
    }
    return sidebarOriginalTop;
  }

  function handleScroll() {
    const scrollY = window.pageYOffset;
    const originalTop = getSidebarOriginalTop();
    const navHeight = 104;
    const targetStickyTop = navHeight; // Where we want sidebar top to be when sticky

    if (isSticky) {
      // Calculate sticky transform
      const stickyTransform = Math.max(
        0,
        scrollY + targetStickyTop - originalTop,
      );
      sidebar.style.transform = `translateY(${stickyTransform}px)`;

      // Check if providers card would hit property history bottom
      const providersCardRect = providersCard.getBoundingClientRect();
      const propertyHistoryRect =
        propertyHistorySection.getBoundingClientRect();
      const providersBottom = providersCardRect.bottom;
      const historyBottom = propertyHistoryRect.bottom;
      const buffer = 10;

      if (
        providersBottom + buffer >= historyBottom &&
        historyBottom < window.innerHeight
      ) {
        // Record where we transition and switch to scrolling mode
        transitionPoint = stickyTransform;
        isSticky = false;
        condensedProviders.classList.add("show");
      }
    } else {
      // In scrolling mode - gradually return to natural position
      const scrollDelta = scrollY + targetStickyTop - originalTop;
      const targetTransform = Math.max(
        0,
        Math.min(transitionPoint, scrollDelta),
      );
      sidebar.style.transform = `translateY(${targetTransform}px)`;

      // Check if we should go back to sticky
      const propertyHistoryRect =
        propertyHistorySection.getBoundingClientRect();
      const historyTop = propertyHistoryRect.top;
      const windowHeight = window.innerHeight;

      if (historyTop > windowHeight * 0.3) {
        // Transition back to sticky mode
        isSticky = true;
        condensedProviders.classList.remove("show");
      }
    }
  }

  // Add scroll event listener with throttling for performance
  let ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  });

  // Add click handler to "view all providers" button
  const viewAllProvidersBtn = document.getElementById("view-all-providers-btn");
  const providersOverlay = document.getElementById("providers-overlay");
  const closeOverlayBtn = document.getElementById("close-overlay-btn");
  const providersOverlayList = document.querySelector(
    ".providers-overlay-list",
  );

  if (viewAllProvidersBtn && providersOverlay) {
    viewAllProvidersBtn.addEventListener("click", function (e) {
      e.stopPropagation();

      // Copy providers content to overlay
      if (providersOverlayList && providersCard) {
        const providersListClone = providersCard
          .querySelector(".providers-list")
          .cloneNode(true);
        providersOverlayList.innerHTML = "";
        providersOverlayList.appendChild(providersListClone);
      }

      // Position overlay relative to condensed card
      const condensedRect = condensedProviders.getBoundingClientRect();
      const overlayContent = providersOverlay.querySelector(
        ".providers-overlay-content",
      );
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate position ensuring overlay stays in viewport
      let top = condensedRect.top;
      let left = condensedRect.left;
      const overlayWidth = 274; // Fixed width to match original providers card

      // Adjust position if overlay would go off screen
      if (left + overlayWidth > viewportWidth - 20) {
        left = viewportWidth - overlayWidth - 20;
      }
      if (left < 20) {
        left = 20;
      }

      // Ensure overlay doesn't go below viewport
      if (top + 500 > viewportHeight) {
        top = Math.max(20, viewportHeight - 500);
      }

      overlayContent.style.top = top + "px";
      overlayContent.style.left = left + "px";

      // Show overlay
      providersOverlay.classList.add("show");
    });
  }

  // Close overlay handlers
  if (closeOverlayBtn && providersOverlay) {
    closeOverlayBtn.addEventListener("click", function () {
      providersOverlay.classList.remove("show");
    });

    // Close on background click
    providersOverlay.addEventListener("click", function (e) {
      if (e.target === providersOverlay) {
        providersOverlay.classList.remove("show");
      }
    });

    // Close on escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && providersOverlay.classList.contains("show")) {
        providersOverlay.classList.remove("show");
      }
    });
  }

  // Initial check after layout is complete
  setTimeout(() => {
    getSidebarOriginalTop();
    handleScroll();
  }, 100);
}

document.addEventListener("DOMContentLoaded", function () {
  setupNavigation();
  setupChartTabs();
  setupTimeRangeSelector();
  toggleNavigationOnShortPage();
  setupStickyProviders();

  // Initialize the charts with a small delay to ensure CSS is loaded
  setTimeout(() => {
    renderSalesPriceChart();
    renderTaxAssessmentChart();
  }, 100);
});
