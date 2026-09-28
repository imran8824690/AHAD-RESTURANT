// Keep sample reviews here so names and quotes are easy to replace.
    const reviews = [
      { quote: "Every plate felt thoughtful, and somehow the whole evening felt effortless. We already picked a date to come back.", name: "Sofia M.", detail: "Dinner with friends", initials: "SM" },
      { quote: "The kind of neighborhood place you hope never changes. Warm welcome, beautiful food, no reason to look at the clock.", name: "James R.", detail: "A local regular", initials: "JR" },
      { quote: "We came for a birthday and left talking about the bread, the pasta, and when we can come back. Just lovely.", name: "Priya K.", detail: "Celebrated a birthday", initials: "PK" },
      { quote: "Seasonal, generous, and genuinely delicious. The team made the whole night feel special without making a fuss.", name: "Daniel & Lee", detail: "Weekend guests", initials: "DL" },
      { quote: "A beautiful room, a thoughtful menu, and the sort of service that makes you feel like you belong there.", name: "Amara T.", detail: "First-time guest", initials: "AT" },
      { quote: "The perfect long dinner: wonderful food, a good glass of wine, and one more dessert than we planned.", name: "Oliver P.", detail: "Dinner for two", initials: "OP" }
    ];

    const header = document.querySelector("#site-header");
    const menuToggle = document.querySelector(".menu-toggle");
    const navLinks = document.querySelector("#nav-links");
    const reservationDialog = document.querySelector("#reservation-dialog");

    function setMenuOpen(isOpen) {
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
      navLinks.classList.toggle("is-open", isOpen);
      document.body.classList.toggle("menu-open", isOpen);
    }

    menuToggle.addEventListener("click", () => setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true"));
    navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenuOpen(false)));
    window.addEventListener("scroll", () => header.classList.toggle("scrolled", window.scrollY > 24), { passive: true });

    document.querySelectorAll(".filter-button").forEach((button) => {
      button.addEventListener("click", () => {
        const category = button.dataset.category;
        document.querySelectorAll(".filter-button").forEach((filter) => filter.setAttribute("aria-pressed", String(filter === button)));
        document.querySelectorAll(".menu-item").forEach((item) => {
          item.hidden = category !== "all" && item.dataset.category !== category;
        });
      });
    });

    let reviewOffset = 0;
    const reviewGrid = document.querySelector("#review-grid");
    function renderReviews() {
      const count = window.innerWidth <= 680 ? 1 : 3;
      reviewGrid.innerHTML = Array.from({ length: count }, (_, index) => {
        const review = reviews[(reviewOffset + index) % reviews.length];
        return `<article class="review-card"><div class="review-stars" aria-label="5 out of 5 stars">★★★★★</div><blockquote>“${review.quote}”</blockquote><div class="review-author"><span class="review-avatar" aria-hidden="true">${review.initials}</span><div><strong>${review.name}</strong><span>${review.detail}</span></div></div></article>`;
      }).join("");
    }
    document.querySelector("#reviews-prev").addEventListener("click", () => { reviewOffset = (reviewOffset - 1 + reviews.length) % reviews.length; renderReviews(); });
    document.querySelector("#reviews-next").addEventListener("click", () => { reviewOffset = (reviewOffset + 1) % reviews.length; renderReviews(); });
    window.addEventListener("resize", renderReviews);
    renderReviews();

    function openReservation() {
      setMenuOpen(false);
      if (reservationDialog.open) return;
      bookingForm.reset();
      formStatus.textContent = "";
      submitButton.disabled = false;
      submitButton.innerHTML = originalSubmitLabel;
      reservationDialog.showModal();
    }
    document.querySelectorAll(".js-open-reservation").forEach((button) => button.addEventListener("click", openReservation));
    document.querySelector(".dialog-close").addEventListener("click", () => reservationDialog.close());
    reservationDialog.addEventListener("click", (event) => {
      if (event.target === reservationDialog) reservationDialog.close();
    });
    document.querySelector("#booking-date").min = new Date().toISOString().slice(0, 10);
    const bookingForm = document.querySelector("#booking-form");
    const formStatus = document.querySelector("#form-status");
    const submitButton = bookingForm.querySelector("button[type='submit']");
    const originalSubmitLabel = submitButton.innerHTML;

    bookingForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      submitButton.disabled = true;
      submitButton.textContent = "Sending request...";
      formStatus.textContent = "";

      try {
        const response = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(bookingForm)))
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Please check your details and try again.");

        bookingForm.reset();
        formStatus.textContent = result.message;
        submitButton.textContent = "Request received";
      } catch (error) {
        formStatus.textContent = error instanceof TypeError
          ? "We couldn't reach the reservation service. Please try again in a moment."
          : error.message;
        submitButton.disabled = false;
        submitButton.innerHTML = originalSubmitLabel;
      }
    });
    document.querySelector("#current-year").textContent = new Date().getFullYear();
