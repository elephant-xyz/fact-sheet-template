/**
 * @file Contains all the client-side JavaScript for the property listing page.
 * This includes functionality for the image carousel, smooth scrolling navigation,
 * and event tracking.
 */

/* global getComputedStyle */

/**
 * Handles the logic for displaying the next image in the carousel.
 * It finds the currently selected radio button and checks the next one in the sequence,
 * looping back to the beginning if the last image is currently displayed.
 */
// eslint-disable-next-line no-unused-vars
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

  // eslint-disable-next-line no-console
  console.log("Final sales data:", salesData);

  // Sort by date (oldest first)
  salesData.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });

  // Extract only the year from the date string for x-axis labels
  const labels = salesData.map((entry) => {
    // Try to extract a 4-digit year from the string
    const match = entry.date.match(/\d{4}/);
    return match ? match[0] : entry.date;
  });
  const prices = salesData.map((entry) => entry.amount);

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

  // Helper function to get CSS custom property with fallback
  function getCSSVar(property, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(
      property,
    );
    return value ? value.trim() : fallback;
  }

  // eslint-disable-next-line no-undef
  window.salesChart = new Chart(context, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Sale Price",
          data: prices,
          // Add metadata for tooltips
          saleData: salesData,
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
                  
                  // Check for multiple owners using common delimiters
                  const delimiters = [' & ', ' and ', ', ', ';', '&'];
                  let owners = [ownerString];
                  
                  // Try to split on common delimiters to find multiple owners
                  for (const delimiter of delimiters) {
                    if (ownerString.includes(delimiter)) {
                      owners = ownerString.split(delimiter).map(owner => owner.trim());
                      break;
                    }
                  }
                  
                  // Format and display all owners
                  if (owners.length === 1) {
                    // Single owner - format as before
                    const ownerName = owners[0];
                    const nameParts = ownerName.split(" ");
                    if (nameParts.length >= 2) {
                      // If there are at least 2 parts, put comma after the first part (last name)
                      const lastName = nameParts[0];
                      const firstName = nameParts.slice(1).join(" ");
                      lines.push("Owner: " + lastName + ", " + firstName);
                    } else {
                      // If only one part, just add comma at the end
                      lines.push("Owner: " + ownerName + ",");
                    }
                  } else {
                    // Multiple owners - display each on a separate line
                    owners.forEach((owner, index) => {
                      const ownerName = owner.trim();
                      if (ownerName) {
                        const nameParts = ownerName.split(" ");
                        let formattedName = ownerName;
                        
                        if (nameParts.length >= 2) {
                          // If there are at least 2 parts, put comma after the first part (last name)
                          const lastName = nameParts[0];
                          const firstName = nameParts.slice(1).join(" ");
                          formattedName = lastName + ", " + firstName;
                        }
                        
                        const prefix = index === 0 ? "Owners: " : "        ";
                        lines.push(prefix + formattedName);
                      }
                    });
                  }
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
    plugins: [
      {
        id: "priceLabelsBelow",
        afterDatasetsDraw(chart, _args, _pluginOptions) {
          const { ctx, chartArea } = chart;
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          ctx.save();
          ctx.font = `${getCSSVar("--chart-price-label-size", "12")}px ${getCSSVar("--chart-font-family", "neue-haas-grotesk-display, system-ui, sans-serif")}`;
          ctx.fillStyle = getCSSVar("--chart-price-label-color", "#423e3e");

          // Store label positions to check for overlaps
          const labelPositions = [];

          meta.data.forEach((point, i) => {
            const price = dataset.data[i];
            if (price == null || isNaN(price) || price === null) return;

            const x = point.x;
            const y = point.y;
            // Format label as $XXX.Xk
            const label = `$${(price / 1000).toFixed(1)}k`;

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
            if (isNearTop) {
              // Near top - prefer below, then right/left, then above
              positions = [
                { x: x, y: y + 16, align: "center", baseline: "top" }, // Below
                { x: x + 16, y: y, align: "left", baseline: "middle" }, // Right
                { x: x - 16, y: y, align: "right", baseline: "middle" }, // Left
                { x: x, y: y - 16, align: "center", baseline: "bottom" }, // Above
              ];
            } else if (isNearBottom) {
              // Near bottom - prefer above, then right/left, then below
              positions = [
                { x: x, y: y - 16, align: "center", baseline: "bottom" }, // Above
                { x: x + 16, y: y, align: "left", baseline: "middle" }, // Right
                { x: x - 16, y: y, align: "right", baseline: "middle" }, // Left
                { x: x, y: y + 16, align: "center", baseline: "top" }, // Below
              ];
            } else if (isNearLeft) {
              // Near left - prefer right, then above/below, then left
              positions = [
                { x: x + 16, y: y, align: "left", baseline: "middle" }, // Right
                { x: x, y: y - 16, align: "center", baseline: "bottom" }, // Above
                { x: x, y: y + 16, align: "center", baseline: "top" }, // Below
                { x: x - 16, y: y, align: "right", baseline: "middle" }, // Left
              ];
            } else if (isNearRight) {
              // Near right - prefer left, then above/below, then right
              positions = [
                { x: x - 16, y: y, align: "right", baseline: "middle" }, // Left
                { x: x, y: y - 16, align: "center", baseline: "bottom" }, // Above
                { x: x, y: y + 16, align: "center", baseline: "top" }, // Below
                { x: x + 16, y: y, align: "left", baseline: "middle" }, // Right
              ];
            } else {
              // Middle of chart - prefer above/below, then left/right
              positions = [
                { x: x, y: y - 16, align: "center", baseline: "bottom" }, // Above
                { x: x, y: y + 16, align: "center", baseline: "top" }, // Below
                { x: x + 16, y: y, align: "left", baseline: "middle" }, // Right
                { x: x - 16, y: y, align: "right", baseline: "middle" }, // Left
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
      },
    ],
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

  // eslint-disable-next-line no-console
  console.log("Final tax data:", taxData);

  // Sort by year (oldest first)
  taxData.sort((a, b) => parseInt(a.year) - parseInt(b.year));

  // Extract years and assessed values
  const labels = taxData.map((entry) => entry.year);
  const assessedValues = taxData.map((entry) => entry.assessedValue);

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

  // Helper function to get CSS custom property with fallback
  function getCSSVar(property, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(
      property,
    );
    return value ? value.trim() : fallback;
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
          taxData: taxData,
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
    plugins: [
      {
        id: "taxPriceLabelsBelow",
        afterDatasetsDraw(chart, _args, _pluginOptions) {
          const { ctx, chartArea } = chart;
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          ctx.save();
          ctx.font = `${getCSSVar("--chart-price-label-size", "12")}px ${getCSSVar("--chart-font-family", "neue-haas-grotesk-display, system-ui, sans-serif")}`;
          ctx.fillStyle = getCSSVar("--chart-price-label-color", "#423e3e");

          // Store label positions to check for overlaps
          const labelPositions = [];

          meta.data.forEach((point, i) => {
            const value = dataset.data[i];
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
            if (isNearTop) {
              // Near top - prefer below, then right/left, then above
              positions = [
                { x: x, y: y + 16, align: "center", baseline: "top" }, // Below
                { x: x + 16, y: y, align: "left", baseline: "middle" }, // Right
                { x: x - 16, y: y, align: "right", baseline: "middle" }, // Left
                { x: x, y: y - 16, align: "center", baseline: "bottom" }, // Above
              ];
            } else if (isNearBottom) {
              // Near bottom - prefer above, then right/left, then below
              positions = [
                { x: x, y: y - 16, align: "center", baseline: "bottom" }, // Above
                { x: x + 16, y: y, align: "left", baseline: "middle" }, // Right
                { x: x - 16, y: y, align: "right", baseline: "middle" }, // Left
                { x: x, y: y + 16, align: "center", baseline: "top" }, // Below
              ];
            } else if (isNearLeft) {
              // Near left - prefer right, then above/below, then left
              positions = [
                { x: x + 16, y: y, align: "left", baseline: "middle" }, // Right
                { x: x, y: y - 16, align: "center", baseline: "bottom" }, // Above
                { x: x, y: y + 16, align: "center", baseline: "top" }, // Below
                { x: x - 16, y: y, align: "right", baseline: "middle" }, // Left
              ];
            } else if (isNearRight) {
              // Near right - prefer left, then above/below, then right
              positions = [
                { x: x - 16, y: y, align: "right", baseline: "middle" }, // Left
                { x: x, y: y - 16, align: "center", baseline: "bottom" }, // Above
                { x: x, y: y + 16, align: "center", baseline: "top" }, // Below
                { x: x + 16, y: y, align: "left", baseline: "middle" }, // Right
              ];
            } else {
              // Middle of chart - prefer above/below, then left/right
              positions = [
                { x: x, y: y - 16, align: "center", baseline: "bottom" }, // Above
                { x: x, y: y + 16, align: "center", baseline: "top" }, // Below
                { x: x + 16, y: y, align: "left", baseline: "middle" }, // Right
                { x: x - 16, y: y, align: "right", baseline: "middle" }, // Left
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
      },
    ],
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
document.addEventListener("DOMContentLoaded", function () {
  setupNavigation();
  setupChartTabs();
  toggleNavigationOnShortPage();

  // Initialize the charts with a small delay to ensure CSS is loaded
  setTimeout(() => {
    renderSalesPriceChart();
    renderTaxAssessmentChart();
  }, 100);
});
