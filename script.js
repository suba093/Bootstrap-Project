(function () {
  const initialCars = window.wantedCarsInitial || [];
  let cars = initialCars;
  let adminCars = [];
  let categories = ['Supercar', 'Hypercar', 'Track', 'JDM Legend', '90s Supercar', '80s/90s Icon'];
  let client = null;
  let currentUser = null;
  let isAdmin = false;
  let accountModal;
  let adminModal;
  let submissionModal;
  let carDetailModal;

  const hasSupabaseConfig =
    window.WANTEDCARS_SUPABASE_URL &&
    window.WANTEDCARS_SUPABASE_ANON_KEY &&
    !window.WANTEDCARS_SUPABASE_URL.includes('YOUR_PROJECT_ID') &&
    !window.WANTEDCARS_SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY');

  function showMessage(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = message;
    element.classList.remove('d-none');
  }

  function hideMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) element.classList.add('d-none');
  }

  function showBackendNotice(message, type) {
    const notice = document.getElementById('backendNotice');
    document.getElementById('backendNoticeText').textContent = message;
    notice.className = `alert alert-${type} alert-dismissible app-notice`;
  }

  function closeMobileNavigation() {
    const navigation = document.getElementById('navbarMain');
    const collapse = bootstrap.Collapse.getInstance(navigation);
    if (collapse) collapse.hide();
  }

  function showSupabaseSetupNotice() {
    const reasons = [];
    if (location.protocol === 'file:') {
      reasons.push('Open the site through GitHub Pages or localhost, not as a file.');
    }
    if (!hasSupabaseConfig) {
      reasons.push('Add your Supabase project URL and anon/public key to supabase-config.js.');
    }
    if (!window.supabase) {
      reasons.push('The Supabase client library did not load.');
    }
    showBackendNotice(
      `Admin Portal, registration, and car submissions need Supabase. ${reasons.join(' ')} See SUPABASE_SETUP.md.`,
      'warning'
    );
  }

  function fromDatabaseCar(car) {
    return {
      ...car,
      topSpeed: car.top_speed || '',
      ownerId: car.owner_id || '',
      createdAt: car.created_at || ''
    };
  }

  function populateCategoryDropdown(selected, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.replaceChildren();
    categories.forEach(category => {
      select.add(new Option(category, category, false, category === selected));
    });
  }

  function makeTextElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text || '';
    return element;
  }

  function renderPublicCars() {
    const grid = document.getElementById('carGrid');
    const countBadge = document.getElementById('carCountBadge');
    grid.replaceChildren();
    countBadge.textContent = `${cars.length} cars`;

    if (cars.length === 0) {
      grid.appendChild(makeTextElement('p', 'text-light', 'No approved cars are listed yet.'));
      return;
    }

    cars.forEach(car => {
      const col = document.createElement('div');
      col.className = 'col-md-6 col-lg-4';
      const card = document.createElement('div');
      card.className = 'car-card p-0 h-100 d-flex flex-column';
      const image = document.createElement('img');
      image.src = car.image;
      image.alt = car.name;
      image.className = 'car-img';
      image.onerror = () => {
        image.onerror = null;
        image.src = 'https://placehold.co/600x400?text=Car';
      };
      image.addEventListener('click', () => openCarDetail(car.id));

      const content = document.createElement('div');
      content.className = 'p-3 d-flex flex-column flex-grow-1';
      const titleRow = document.createElement('div');
      titleRow.className = 'd-flex justify-content-between align-items-start mb-2';
      titleRow.appendChild(makeTextElement('h5', 'fw-bold mb-0 car-name', car.name));
      titleRow.appendChild(makeTextElement('span', 'category-badge', car.category));
      content.appendChild(titleRow);
      content.appendChild(makeTextElement('p', 'price-tag mt-auto mb-0', car.price));
      card.append(image, content);
      col.appendChild(card);
      grid.appendChild(col);
    });
  }

  function renderAdminCarTable() {
    const tbody = document.getElementById('adminCarTableBody');
    tbody.replaceChildren();
    adminCars.filter(car => car.status === 'approved').forEach(car => {
      const tr = document.createElement('tr');
      const details = document.createElement('div');
      details.className = 'd-flex align-items-center gap-2';
      const image = document.createElement('img');
      image.src = car.image;
      image.alt = '';
      image.width = 40;
      image.height = 40;
      image.style.objectFit = 'cover';
      image.style.borderRadius = '8px';
      details.append(image, makeTextElement('span', '', car.name));

      const actions = document.createElement('td');
      const editButton = makeTextElement('button', 'btn btn-sm btn-primary me-1', 'Edit');
      editButton.type = 'button';
      editButton.addEventListener('click', () => openCarFormForEdit(car.id));
      const deleteButton = makeTextElement('button', 'btn btn-sm btn-danger', 'Delete');
      deleteButton.type = 'button';
      deleteButton.addEventListener('click', () => deleteCar(car.id));
      actions.append(editButton, deleteButton);

      const carCell = document.createElement('td');
      carCell.appendChild(details);
      tr.append(
        carCell,
        makeTextElement('td', '', car.year),
        makeTextElement('td', '', car.category),
        makeTextElement('td', 'fw-bold text-danger', car.price),
        actions
      );
      tbody.appendChild(tr);
    });
  }

  function renderPendingCars() {
    const tbody = document.getElementById('pendingCarTableBody');
    tbody.replaceChildren();
    adminCars.filter(car => car.status === 'pending').forEach(car => {
      const tr = document.createElement('tr');
      const carCell = document.createElement('td');
      const summary = document.createElement('div');
      summary.className = 'd-flex align-items-start gap-2';
      const image = document.createElement('img');
      image.src = car.image;
      image.alt = '';
      image.width = 80;
      image.height = 56;
      image.style.objectFit = 'cover';
      image.style.borderRadius = '8px';
      const summaryText = document.createElement('div');
      summaryText.append(
        makeTextElement('strong', 'd-block', car.name),
        makeTextElement('small', 'text-muted d-block', `${car.year} · ${car.category} · ${car.price}`)
      );
      const details = document.createElement('details');
      const detailSummary = makeTextElement('summary', 'mt-1', 'View submitted details');
      details.appendChild(detailSummary);
      const detailList = document.createElement('dl');
      detailList.className = 'row small mt-2 mb-0';
      [
        ['Description', car.description],
        ['Engine', car.engine],
        ['Power', car.power],
        ['Torque', car.torque],
        ['0-100', car.acceleration],
        ['Top speed', car.top_speed],
        ['Transmission', car.transmission],
        ['Drivetrain', car.drivetrain],
        ['Weight', car.weight],
        ['Region', car.region]
      ].forEach(([label, value]) => {
        if (!value) return;
        detailList.append(
          makeTextElement('dt', 'col-sm-4', label),
          makeTextElement('dd', 'col-sm-8', value)
        );
      });
      details.appendChild(detailList);
      summaryText.appendChild(details);
      summary.append(image, summaryText);
      carCell.appendChild(summary);
      const owner = car.owner_id ? `User ${car.owner_id.slice(0, 8)}` : 'Admin entry';
      const actions = document.createElement('td');
      const approveButton = makeTextElement('button', 'btn btn-sm btn-success me-1', 'Approve');
      approveButton.type = 'button';
      approveButton.addEventListener('click', () => reviewCar(car, 'approved'));
      const rejectButton = makeTextElement('button', 'btn btn-sm btn-outline-danger', 'Reject');
      rejectButton.type = 'button';
      rejectButton.addEventListener('click', () => reviewCar(car, 'rejected'));
      actions.append(approveButton, rejectButton);
      tr.append(
        carCell,
        makeTextElement('td', '', owner),
        makeTextElement('td', '', car.created_at ? new Date(car.created_at).toLocaleDateString() : ''),
        actions
      );
      tbody.appendChild(tr);
    });
    if (!tbody.children.length) {
      const row = document.createElement('tr');
      row.appendChild(makeTextElement('td', 'text-muted', 'There are no submissions awaiting review.'));
      row.firstElementChild.colSpan = 4;
      tbody.appendChild(row);
    }
  }

  function renderCategoryBadges() {
    const container = document.getElementById('categoryListContainer');
    container.replaceChildren();
    categories.forEach(category => {
      const item = makeTextElement('span', 'category-item d-inline-flex align-items-center mb-2 me-2', category);
      const removeButton = makeTextElement('button', 'btn btn-sm text-danger p-0 ms-2', '×');
      removeButton.type = 'button';
      removeButton.setAttribute('aria-label', `Delete ${category}`);
      removeButton.addEventListener('click', () => deleteCategory(category));
      item.appendChild(removeButton);
      container.appendChild(item);
    });
  }

  function openCarDetail(id) {
    const car = cars.find(item => item.id === id);
    if (!car) return;
    document.getElementById('detailCarName').textContent = car.name;
    document.getElementById('detailCarImage').src = car.image;
    document.getElementById('detailCarImage').alt = car.name;
    document.getElementById('detailCarCategory').textContent = car.category;
    document.getElementById('detailCarPrice').textContent = car.price;
    document.getElementById('detailCarDescription').textContent = car.description || 'No description.';
    document.getElementById('detailEngine').textContent = car.engine || '—';
    document.getElementById('detailTopSpeed').textContent = car.topSpeed || '—';
    document.getElementById('detailAcceleration').textContent = car.acceleration || '—';
    document.getElementById('detailPower').textContent = car.power || '—';
    document.getElementById('detailYear').textContent = car.year || '—';
    document.getElementById('detailRegion').textContent = car.region || '—';
    document.getElementById('detailTorque').textContent = car.torque || '—';
    document.getElementById('detailTransmission').textContent = car.transmission || '—';
    document.getElementById('detailDrivetrain').textContent = car.drivetrain || '—';
    document.getElementById('detailWeight').textContent = car.weight || '—';
    carDetailModal.show();
  }

  async function loadPublicCars() {
    const { data, error } = await client
      .from('cars')
      .select('id,name,category,year,price,image,description,engine,power,torque,acceleration,top_speed,transmission,drivetrain,weight,region,created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (error) throw error;
    cars = data.map(fromDatabaseCar);
    renderPublicCars();
  }

  async function loadCategories() {
    const { data, error } = await client.from('categories').select('name').order('name');
    if (error) throw error;
    categories = data.map(row => row.name);
    populateCategoryDropdown('', 'carCategory');
    populateCategoryDropdown('', 'submissionCategory');
    renderCategoryBadges();
  }

  async function loadAdminData() {
    if (!isAdmin) return;
    const { data, error } = await client.from('cars').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    adminCars = data;
    renderAdminCarTable();
    renderPendingCars();
  }

  async function refreshAuthentication(session) {
    currentUser = session ? session.user : null;
    isAdmin = false;
    if (currentUser) {
      try {
        const { data, error } = await client.rpc('is_admin');
        if (error) {
          showBackendNotice(`Could not check admin access: ${error.message}`, 'danger');
        } else {
          isAdmin = data === true;
        }
      } catch (error) {
        showBackendNotice(`Could not check admin access: ${error.message}`, 'danger');
      }
    }
    const accountButton = document.getElementById('accountBtn');
    accountButton.innerHTML = '';
    const icon = document.createElement('i');
    icon.className = `bi ${currentUser ? 'bi-box-arrow-right' : 'bi-person-circle'} me-2`;
    accountButton.appendChild(icon);
    accountButton.append(document.createTextNode(currentUser ? 'Sign out' : 'Sign in / Register'));
    if (isAdmin) {
      try {
        await loadAdminData();
      } catch (error) {
        showBackendNotice(`Could not load admin data: ${error.message}`, 'danger');
      }
    }
  }

  async function openSubmissionForm() {
    if (!client) {
      showSupabaseSetupNotice();
      return;
    }
    if (!currentUser) {
      accountModal.show();
      showMessage('accountNotice', 'Sign in or create an account before submitting a car.');
      return;
    }
    hideMessage('submissionError');
    document.getElementById('submissionForm').reset();
    try {
      await loadCategories();
      submissionModal.show();
    } catch (error) {
      showBackendNotice(`Could not load car categories: ${error.message}`, 'danger');
    }
  }

  function openCarFormForEdit(id) {
    const car = adminCars.find(item => item.id === id);
    if (!car) return;
    document.getElementById('carFormTitle').textContent = 'Edit Car';
    document.getElementById('carEditId').value = car.id;
    document.getElementById('carName').value = car.name;
    document.getElementById('carCategory').value = car.category;
    document.getElementById('carYear').value = car.year;
    document.getElementById('carPrice').value = car.price;
    document.getElementById('carImage').value = car.image;
    document.getElementById('carDescription').value = car.description || '';
    document.getElementById('carEngine').value = car.engine || '';
    document.getElementById('carPower').value = car.power || '';
    document.getElementById('carTorque').value = car.torque || '';
    document.getElementById('carAcceleration').value = car.acceleration || '';
    document.getElementById('carTopSpeed').value = car.top_speed || '';
    document.getElementById('carTransmission').value = car.transmission || '';
    document.getElementById('carDrivetrain').value = car.drivetrain || '';
    document.getElementById('carWeight').value = car.weight || '';
    document.getElementById('carRegion').value = car.region || '';
    document.getElementById('carFormContainer').classList.remove('d-none');
  }

  function adminCarFromForm() {
    return {
      name: document.getElementById('carName').value.trim(),
      category: document.getElementById('carCategory').value,
      year: document.getElementById('carYear').value.trim(),
      price: document.getElementById('carPrice').value.trim(),
      image: document.getElementById('carImage').value.trim(),
      description: document.getElementById('carDescription').value.trim(),
      engine: document.getElementById('carEngine').value.trim(),
      power: document.getElementById('carPower').value.trim(),
      torque: document.getElementById('carTorque').value.trim(),
      acceleration: document.getElementById('carAcceleration').value.trim(),
      top_speed: document.getElementById('carTopSpeed').value.trim(),
      transmission: document.getElementById('carTransmission').value.trim(),
      drivetrain: document.getElementById('carDrivetrain').value.trim(),
      weight: document.getElementById('carWeight').value.trim(),
      region: document.getElementById('carRegion').value.trim()
    };
  }

  async function submitUserCar(event) {
    event.preventDefault();
    hideMessage('submissionError');
    if (!currentUser) {
      showMessage('submissionError', 'Please sign in again before submitting.');
      return;
    }
    const file = document.getElementById('submissionImage').files[0];
    if (!file || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      showMessage('submissionError', 'Choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showMessage('submissionError', 'The image must be 5 MB or smaller.');
      return;
    }

    const extension = file.type.split('/')[1].replace('jpeg', 'jpg');
    const imagePath = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
    const imageStore = client.storage.from('car-images');
    try {
      const { error: uploadError } = await imageStore.upload(imagePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false
      });
      if (uploadError) {
        showMessage('submissionError', `Image upload failed: ${uploadError.message}`);
        return;
      }

      const imageUrl = imageStore.getPublicUrl(imagePath).data.publicUrl;
      const submission = {
        owner_id: currentUser.id,
        name: document.getElementById('submissionName').value.trim(),
        category: document.getElementById('submissionCategory').value,
        year: document.getElementById('submissionYear').value.trim(),
        price: document.getElementById('submissionPrice').value.trim(),
        image: imageUrl,
        description: document.getElementById('submissionDescription').value.trim(),
        engine: document.getElementById('submissionEngine').value.trim(),
        power: document.getElementById('submissionPower').value.trim(),
        torque: document.getElementById('submissionTorque').value.trim(),
        acceleration: document.getElementById('submissionAcceleration').value.trim(),
        top_speed: document.getElementById('submissionTopSpeed').value.trim(),
        transmission: document.getElementById('submissionTransmission').value.trim(),
        drivetrain: document.getElementById('submissionDrivetrain').value.trim(),
        weight: document.getElementById('submissionWeight').value.trim(),
        region: document.getElementById('submissionRegion').value.trim(),
        status: 'pending'
      };
      const { error } = await client.from('cars').insert(submission);
      if (error) {
        const { error: cleanupError } = await imageStore.remove([imagePath]);
        const cleanupMessage = cleanupError ? ` Image cleanup also failed: ${cleanupError.message}` : '';
        showMessage('submissionError', `Could not submit car: ${error.message}.${cleanupMessage}`);
        return;
      }
      document.getElementById('submissionForm').reset();
      submissionModal.hide();
      alert('Your car was submitted and is waiting for admin approval.');
    } catch (error) {
      showMessage('submissionError', `Could not upload your submission: ${error.message}`);
    }
  }

  async function reviewCar(car, status) {
    try {
      const { error } = await client
        .from('cars')
        .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: currentUser.id })
        .eq('id', car.id);
      if (error) {
        showBackendNotice(`Could not ${status} "${car.name}": ${error.message}`, 'danger');
        return;
      }
      await Promise.all([loadAdminData(), loadPublicCars()]);
    } catch (error) {
      showBackendNotice(`Could not ${status} "${car.name}": ${error.message}`, 'danger');
    }
  }

  async function deleteCar(id) {
    const car = adminCars.find(item => item.id === id);
    if (!car || !confirm(`Delete "${car.name}"?`)) return;
    try {
      const { error } = await client.from('cars').delete().eq('id', id);
      if (error) {
        showBackendNotice(`Could not delete "${car.name}": ${error.message}`, 'danger');
        return;
      }
      await Promise.all([loadAdminData(), loadPublicCars()]);
    } catch (error) {
      showBackendNotice(`Could not delete "${car.name}": ${error.message}`, 'danger');
    }
  }

  async function deleteCategory(category) {
    if (adminCars.some(car => car.category === category)) {
      alert(`Cannot delete "${category}" while cars use it.`);
      return;
    }
    try {
      const { error } = await client.from('categories').delete().eq('name', category);
      if (error) {
        showBackendNotice(`Could not delete category: ${error.message}`, 'danger');
        return;
      }
      await loadCategories();
    } catch (error) {
      showBackendNotice(`Could not delete category: ${error.message}`, 'danger');
    }
  }

  function setAccountTab(tab) {
    const register = tab === 'register';
    document.getElementById('loginForm').classList.toggle('d-none', register);
    document.getElementById('registerForm').classList.toggle('d-none', !register);
    document.querySelectorAll('[data-account-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.accountTab === tab);
    });
    hideMessage('accountError');
    hideMessage('accountNotice');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    accountModal = new bootstrap.Modal(document.getElementById('accountModal'));
    adminModal = new bootstrap.Modal(document.getElementById('adminModal'));
    submissionModal = new bootstrap.Modal(document.getElementById('submissionModal'));
    carDetailModal = new bootstrap.Modal(document.getElementById('carDetailModal'));
    renderPublicCars();
    populateCategoryDropdown('', 'carCategory');
    populateCategoryDropdown('', 'submissionCategory');
    renderCategoryBadges();

    document.querySelectorAll('[data-account-tab]').forEach(button => {
      button.addEventListener('click', () => setAccountTab(button.dataset.accountTab));
    });
    document.querySelector('#backendNotice .btn-close').addEventListener('click', () => {
      document.getElementById('backendNotice').classList.add('d-none');
    });
    document.getElementById('accountBtn').addEventListener('click', async () => {
      closeMobileNavigation();
      if (!client) {
        showSupabaseSetupNotice();
        return;
      }
      if (currentUser) {
        try {
          const { error } = await client.auth.signOut();
          if (error) showBackendNotice(`Could not sign out: ${error.message}`, 'danger');
        } catch (error) {
          showBackendNotice(`Could not sign out: ${error.message}`, 'danger');
        }
      } else {
        setAccountTab('login');
        accountModal.show();
      }
    });
    document.getElementById('adminPortalBtn').addEventListener('click', () => {
      closeMobileNavigation();
      if (!client) {
        showSupabaseSetupNotice();
      } else if (!currentUser) {
        setAccountTab('login');
        accountModal.show();
      } else if (!isAdmin) {
        showBackendNotice('This account does not have admin access.', 'warning');
      } else {
        adminModal.show();
      }
    });
    document.getElementById('submitCarBtn').addEventListener('click', () => {
      closeMobileNavigation();
      void openSubmissionForm();
    });

    document.getElementById('loginForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (!client) return;
      hideMessage('accountError');
      try {
        const { error } = await client.auth.signInWithPassword({
          email: document.getElementById('loginEmail').value.trim(),
          password: document.getElementById('loginPassword').value
        });
        if (error) {
          showMessage('accountError', error.message);
          return;
        }
        accountModal.hide();
      } catch (error) {
        showMessage('accountError', `Could not sign in: ${error.message}`);
      }
    });

    document.getElementById('registerForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (!client) return;
      hideMessage('accountError');
      try {
        const { data, error } = await client.auth.signUp({
          email: document.getElementById('registerEmail').value.trim(),
          password: document.getElementById('registerPassword').value,
          options: {
            data: { display_name: document.getElementById('registerName').value.trim() }
          }
        });
        if (error) {
          showMessage('accountError', error.message);
          return;
        }
        if (data.session) {
          accountModal.hide();
        } else {
          showMessage('accountNotice', 'Check your email to confirm your account, then sign in.');
        }
      } catch (error) {
        showMessage('accountError', `Could not create account: ${error.message}`);
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      try {
        const { error } = await client.auth.signOut();
        if (error) showBackendNotice(`Could not sign out: ${error.message}`, 'danger');
        else adminModal.hide();
      } catch (error) {
        showBackendNotice(`Could not sign out: ${error.message}`, 'danger');
      }
    });

    document.getElementById('showAddCarFormBtn').addEventListener('click', async () => {
      document.getElementById('carForm').reset();
      document.getElementById('carEditId').value = '';
      document.getElementById('carFormTitle').textContent = 'Add New Car';
      try {
        await loadCategories();
        document.getElementById('carFormContainer').classList.remove('d-none');
      } catch (error) {
        showBackendNotice(`Could not load categories: ${error.message}`, 'danger');
      }
    });
    document.getElementById('cancelCarBtn').addEventListener('click', () => {
      document.getElementById('carFormContainer').classList.add('d-none');
    });
    document.getElementById('carForm').addEventListener('submit', async event => {
      event.preventDefault();
      const editId = document.getElementById('carEditId').value;
      const carData = adminCarFromForm();
      try {
        const result = editId
          ? await client.from('cars').update(carData).eq('id', editId)
          : await client.from('cars').insert({ ...carData, status: 'approved' });
        if (result.error) {
          showBackendNotice(`Could not save car: ${result.error.message}`, 'danger');
          return;
        }
        document.getElementById('carFormContainer').classList.add('d-none');
        await Promise.all([loadAdminData(), loadPublicCars()]);
      } catch (error) {
        showBackendNotice(`Could not save car: ${error.message}`, 'danger');
      }
    });

    document.getElementById('categoryForm').addEventListener('submit', async event => {
      event.preventDefault();
      const input = document.getElementById('newCategoryName');
      const name = input.value.trim();
      if (!name) return;
      try {
        const { error } = await client.from('categories').insert({ name });
        if (error) {
          showBackendNotice(`Could not add category: ${error.message}`, 'danger');
          return;
        }
        input.value = '';
        await loadCategories();
      } catch (error) {
        showBackendNotice(`Could not add category: ${error.message}`, 'danger');
      }
    });
    document.getElementById('submissionForm').addEventListener('submit', submitUserCar);

    if (!hasSupabaseConfig || !window.supabase) {
      showSupabaseSetupNotice();
      return;
    }

    client = window.supabase.createClient(
      window.WANTEDCARS_SUPABASE_URL,
      window.WANTEDCARS_SUPABASE_ANON_KEY
    );
    client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { void refreshAuthentication(session); }, 0);
    });
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await refreshAuthentication(data.session);
      await Promise.all([loadPublicCars(), loadCategories()]);
    } catch (error) {
      showBackendNotice(`Could not connect to Supabase: ${error.message}`, 'danger');
    }
  });
})();
