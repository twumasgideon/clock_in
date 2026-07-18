<?php

declare(strict_types=1);
?>
      </main>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="<?= e(asset('js/connectivity.js')) ?>"></script>
  <script src="<?= e(asset('js/app.js')) ?>"></script>
  <?php if (!empty($pageScripts) && is_array($pageScripts)): ?>
    <?php foreach ($pageScripts as $script): ?>
      <script src="<?= e(asset($script)) ?>"></script>
    <?php endforeach; ?>
  <?php endif; ?>
</body>
</html>
