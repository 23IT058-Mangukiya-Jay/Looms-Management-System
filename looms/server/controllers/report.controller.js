import Production from '../models/Production.model.js';
import Worker from '../models/Worker.model.js';
import Machine from '../models/Machine.model.js';
import PDFDocument from 'pdfkit';
import { startOfMonth, endOfMonth } from 'date-fns';

// @desc    Get worker production report
// @route   GET /api/reports/worker
// @access  Private
export const getWorkerReport = async (req, res) => {
  try {
    const { workerId, startDate, endDate, shift } = req.query;

    let query = {};

    if (workerId) {
      query.worker = workerId;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (shift) {
      query.shift = shift;
    }

    const productions = await Production.find(query)
      .populate('worker', 'name workerCode workerType')
      .populate('machine', 'machineCode machineName')
      .populate('taka', 'takaNumber')
      .populate('qualityType', 'name ratePerMeter')
      .sort({ date: -1 });

    // Group by worker
    const workerGroups = {};
    productions.forEach(prod => {
      const workerId = prod.worker._id.toString();
      if (!workerGroups[workerId]) {
        workerGroups[workerId] = {
          worker: prod.worker,
          productions: [],
          totals: {
            meters: 0,
            earnings: 0,
            dayShiftMeters: 0,
            nightShiftMeters: 0
          }
        };
      }
      workerGroups[workerId].productions.push(prod);
      workerGroups[workerId].totals.meters += prod.metersProduced;
      workerGroups[workerId].totals.earnings += prod.earnings;
      if (prod.shift === 'Day') {
        workerGroups[workerId].totals.dayShiftMeters += prod.metersProduced;
      } else {
        workerGroups[workerId].totals.nightShiftMeters += prod.metersProduced;
      }
    });

    res.status(200).json({
      success: true,
      data: Object.values(workerGroups)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get machine production report
// @route   GET /api/reports/machine
// @access  Private
export const getMachineReport = async (req, res) => {
  try {
    const { machineId, startDate, endDate, shift } = req.query;

    let query = {};

    if (machineId) {
      query.machine = machineId;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (shift) {
      query.shift = shift;
    }

    const productions = await Production.find(query)
      .populate('machine', 'machineCode machineName status')
      .populate('worker', 'name workerCode')
      .populate('taka', 'takaNumber')
      .populate('qualityType', 'name ratePerMeter')
      .sort({ date: -1 });

    // Group by machine
    const machineGroups = {};
    productions.forEach(prod => {
      const machineIdStr = prod.machine._id.toString();
      if (!machineGroups[machineIdStr]) {
        machineGroups[machineIdStr] = {
          machine: prod.machine,
          productions: [],
          totals: {
            meters: 0,
            earnings: 0,
            dayShiftMeters: 0,
            nightShiftMeters: 0,
            utilization: 0
          },
          _dateSet: new Set()
        };
      }
      machineGroups[machineIdStr].productions.push(prod);
      machineGroups[machineIdStr].totals.meters += prod.metersProduced;
      machineGroups[machineIdStr].totals.earnings += prod.earnings;
      if (prod.shift === 'Day') {
        machineGroups[machineIdStr].totals.dayShiftMeters += prod.metersProduced;
      } else {
        machineGroups[machineIdStr].totals.nightShiftMeters += prod.metersProduced;
      }
      // track unique production dates for utilization
      if (prod.date) {
        const d = new Date(prod.date).toISOString().split('T')[0];
        machineGroups[machineIdStr]._dateSet.add(d);
      }
    });

    // compute utilization as percentage of days in range that have production
    let totalDaysInRange = 0;
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      totalDaysInRange = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
    }

    Object.values(machineGroups).forEach(g => {
      if (totalDaysInRange > 0) {
        const daysWithProd = g._dateSet.size || 0;
        g.totals.utilization = Number(((daysWithProd / totalDaysInRange) * 100).toFixed(1));
      } else {
        // if no date range provided, compute utilization as 100% if there are productions, else 0
        g.totals.utilization = g._dateSet.size > 0 ? 100 : 0;
      }
      // remove helper set before sending
      delete g._dateSet;
    });

    res.status(200).json({
      success: true,
      data: Object.values(machineGroups)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get salary report
// @route   GET /api/reports/salary
// @access  Private
export const getSalaryReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    const monthStart = startOfMonth(new Date(targetYear, targetMonth));
    const monthEnd = endOfMonth(new Date(targetYear, targetMonth));
    const salaryData = await Production.aggregate([
      {
        $match: {
          date: { $gte: monthStart, $lte: monthEnd }
        }
      },
      {
        $group: {
          _id: '$worker',
          totalMeters: { $sum: '$metersProduced' },
          totalEarnings: { $sum: '$earnings' },
          dayShiftMeters: {
            $sum: {
              $cond: [{ $eq: ['$shift', 'Day'] }, '$metersProduced', 0]
            }
          },
          nightShiftMeters: {
            $sum: {
              $cond: [{ $eq: ['$shift', 'Night'] }, '$metersProduced', 0]
            }
          },
          workDates: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } }
        }
      },
      {
        $project: {
          totalMeters: 1,
          totalEarnings: 1,
          dayShiftMeters: 1,
          nightShiftMeters: 1,
          workingDays: { $size: '$workDates' }
        }
      },
      {
        $lookup: {
          from: 'workers',
          localField: '_id',
          foreignField: '_id',
          as: 'worker'
        }
      },
      { $unwind: '$worker' },
      { $sort: { 'worker.workerCode': 1 } }
    ]);

    // Map to the client's expected shape: workingDays, totalMeters, productionEarnings, totalSalary
    res.status(200).json({
      success: true,
      data: salaryData.map(s => ({
        worker: {
          id: s.worker._id,
          name: s.worker.name,
          workerCode: s.worker.workerCode,
          workerType: s.worker.workerType
        },
        workingDays: s.workingDays || 0,
        totalMeters: s.totalMeters || 0,
        productionEarnings: s.totalEarnings || 0,
        totalSalary: s.totalEarnings || 0
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate PDF report
// @route   POST /api/reports/pdf
// @access  Private
export const generatePDFReport = async (req, res) => {
  try {
    const { reportType, data } = req.body;
    let reportData = data;

    // If client didn't send detailed data, fetch server-side to ensure PDF has details
    if (!reportData || (Array.isArray(reportData) && reportData.length === 0)) {
      const { startDate, endDate, workerId, machineId, month, year } = req.body;

      if (reportType === 'worker') {
        // Reuse getWorkerReport logic: query productions and group by worker
        let query = {};
        if (workerId) query.worker = workerId;
        if (startDate && endDate) query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };

        const productions = await Production.find(query)
          .populate('worker', 'name workerCode workerType')
          .populate('machine', 'machineCode machineName')
          .populate('taka', 'takaNumber')
          .populate('qualityType', 'name ratePerMeter')
          .sort({ date: -1 });

        const workerGroups = {};
        productions.forEach(prod => {
          const id = prod.worker._id.toString();
          if (!workerGroups[id]) {
            workerGroups[id] = { worker: prod.worker, productions: [], totals: { meters: 0, earnings: 0 } };
          }
          workerGroups[id].productions.push(prod);
          workerGroups[id].totals.meters += prod.metersProduced;
          workerGroups[id].totals.earnings += prod.earnings;
        });

        reportData = Object.values(workerGroups);
      } else if (reportType === 'machine') {
        let query = {};
        if (machineId) query.machine = machineId;
        if (startDate && endDate) query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };

        const productions = await Production.find(query)
          .populate('machine', 'machineCode machineName status')
          .populate('worker', 'name workerCode')
          .populate('taka', 'takaNumber')
          .populate('qualityType', 'name ratePerMeter')
          .sort({ date: -1 });

        const machineGroups = {};
        productions.forEach(prod => {
          const id = prod.machine._id.toString();
          if (!machineGroups[id]) {
            machineGroups[id] = { machine: prod.machine, productions: [], totals: { meters: 0, earnings: 0 } };
          }
          machineGroups[id].productions.push(prod);
          machineGroups[id].totals.meters += prod.metersProduced;
          machineGroups[id].totals.earnings += prod.earnings;
        });

        reportData = Object.values(machineGroups);
      } else if (reportType === 'salary') {
        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();
        const monthStart = startOfMonth(new Date(targetYear, targetMonth));
        const monthEnd = endOfMonth(new Date(targetYear, targetMonth));

        const salaryData = await Production.aggregate([
          {
            $match: {
              date: { $gte: monthStart, $lte: monthEnd }
            }
          },
          {
            $group: {
              _id: '$worker',
              totalMeters: { $sum: '$metersProduced' },
              totalEarnings: { $sum: '$earnings' },
              dayShiftMeters: {
                $sum: {
                  $cond: [{ $eq: ['$shift', 'Day'] }, '$metersProduced', 0]
                }
              },
              nightShiftMeters: {
                $sum: {
                  $cond: [{ $eq: ['$shift', 'Night'] }, '$metersProduced', 0]
                }
              }
            }
          },
          {
            $lookup: {
              from: 'workers',
              localField: '_id',
              foreignField: '_id',
              as: 'worker'
            }
          },
          { $unwind: '$worker' },
          { $sort: { 'worker.workerCode': 1 } }
        ]);

        reportData = salaryData.map(s => ({
          worker: {
            id: s.worker._id,
            name: s.worker.name,
            code: s.worker.workerCode,
            type: s.worker.workerType
          },
          metrics: {
            totalMeters: s.totalMeters,
            dayShiftMeters: s.dayShiftMeters,
            nightShiftMeters: s.nightShiftMeters,
            totalEarnings: s.totalEarnings
          }
        }));
      }
    }

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${reportType}-report.pdf`);

    doc.pipe(res);

    // Add header
    doc.fontSize(20).text('Looms Management System', { align: 'center' });
    doc.fontSize(16).text(`${reportType} Report`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.moveDown();
    // helper to paginate
    const ensureSpace = (lines = 4) => {
      const bottomMargin = 72; // default PDF bottom margin
      if (doc.y > doc.page.height - bottomMargin - lines * 14) {
        doc.addPage();
      }
    };

    // Add content based on report type (use reportData fetched or passed)
    if (reportType === 'salary') {
      doc.fontSize(14).text('Monthly Salary Report', { underline: true });
      doc.moveDown();

      reportData.forEach(item => {
        ensureSpace(6);
        doc.fontSize(12).text(`Worker: ${item.worker.name} (${item.worker.code})`);
        doc.fontSize(10).text(`Type: ${item.worker.type}`);
        doc.text(`Total Meters: ${item.metrics.totalMeters}`);
        doc.text(`Day Shift: ${item.metrics.dayShiftMeters} | Night Shift: ${item.metrics.nightShiftMeters}`);
        doc.text(`Total Earnings: ₹${item.metrics.totalEarnings}`);
        doc.moveDown();
      });
    } else if (reportType === 'worker') {
      doc.fontSize(14).text('Worker Production Report', { underline: true });
      doc.moveDown();

      reportData.forEach(group => {
        ensureSpace(6);
        const w = group.worker || {};
        doc.fontSize(12).text(`Worker: ${w.name || 'N/A'} (${w.workerCode || ''})`);
        doc.fontSize(10).text(`Type: ${w.workerType || 'N/A'}`);
        doc.text(`Total Productions: ${group.productions?.length || 0}`);
        doc.text(`Total Meters: ${group.totals?.meters?.toFixed ? group.totals.meters.toFixed(2) : group.totals?.meters || 0}`);
        doc.text(`Total Earnings: ₹${group.totals?.earnings?.toFixed ? group.totals.earnings.toFixed(2) : group.totals?.earnings || 0}`);
        doc.moveDown();

        // Optionally list productions (limited)
        if (group.productions && group.productions.length > 0) {
          doc.fontSize(11).text('Recent Productions:', { underline: false });
          group.productions.slice(0, 10).forEach(p => {
            ensureSpace(2);
            const dateStr = p.date ? new Date(p.date).toLocaleDateString() : '';
            doc.fontSize(10).text(`- ${dateStr} | Meters: ${p.metersProduced} | Earnings: ₹${p.earnings}`);
          });
          if (group.productions.length > 10) {
            doc.fontSize(10).text(`...and ${group.productions.length - 10} more`);
          }
          doc.moveDown();
        }
      });
    } else if (reportType === 'machine') {
      doc.fontSize(14).text('Machine Production Report', { underline: true });
      doc.moveDown();

      reportData.forEach(group => {
        ensureSpace(6);
        const m = group.machine || {};
        doc.fontSize(12).text(`Machine: ${m.machineName || 'N/A'} (${m.machineCode || ''})`);
        doc.fontSize(10).text(`Status: ${m.status || 'N/A'}`);
        doc.text(`Total Productions: ${group.productions?.length || 0}`);
        doc.text(`Total Meters: ${group.totals?.meters?.toFixed ? group.totals.meters.toFixed(2) : group.totals?.meters || 0}`);
        doc.text(`Total Earnings: ₹${group.totals?.earnings?.toFixed ? group.totals.earnings.toFixed(2) : group.totals?.earnings || 0}`);
        doc.moveDown();

        if (group.productions && group.productions.length > 0) {
            // Production history listing removed by request - keep report concise
        }
      });
    } else {
      doc.fontSize(12).text('No report type specified or report type not supported.');
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
